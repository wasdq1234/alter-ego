import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from api.deps import get_current_user
from core.supabase_client import get_supabase
from core.graph import stream_chat

router = APIRouter(tags=["chat"])


class ThreadCreate(BaseModel):
    persona_id: str


class ThreadResponse(BaseModel):
    id: str
    persona_id: str


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


@router.post("/api/chat/thread", response_model=ThreadResponse, status_code=201)
async def find_or_create_thread(
    body: ThreadCreate,
    user: dict = Depends(get_current_user),
):
    """(user_id, persona_id) 기존 스레드 조회 → 있으면 반환, 없으면 생성."""
    sb = get_supabase()

    # 페르소나 소유권 확인
    persona = (
        sb.table("personas")
        .select("id")
        .eq("id", body.persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not persona.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Persona not found")

    # 기존 스레드 조회
    existing = (
        sb.table("chat_threads")
        .select("id, persona_id")
        .eq("user_id", user["id"])
        .eq("persona_id", body.persona_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    result = sb.table("chat_threads").insert({
        "user_id": user["id"],
        "persona_id": body.persona_id,
        "title": "Chat",
    }).execute()

    return result.data[0]


@router.get("/api/chat/thread/{thread_id}/messages", response_model=list[MessageResponse])
async def get_thread_messages(
    thread_id: str,
    user: dict = Depends(get_current_user),
):
    """스레드의 메시지 목록 반환. 소유권 확인 후 created_at 순 정렬."""
    sb = get_supabase()

    # 스레드 소유권 확인
    thread = (
        sb.table("chat_threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not thread.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Thread not found")

    result = (
        sb.table("chat_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", thread_id)
        .order("created_at", desc=False)
        .execute()
    )

    return result.data


async def _authenticate_ws(websocket: WebSocket) -> dict | None:
    """WebSocket 쿼리 파라미터의 token으로 사용자 인증."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        sb = get_supabase()
        response = sb.auth.get_user(token)
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        return None


@router.websocket("/ws/chat/{thread_id}")
async def websocket_chat(websocket: WebSocket, thread_id: str):
    user = await _authenticate_ws(websocket)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    sb = get_supabase()

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            persona_id = data.get("persona_id")
            content = data.get("content", "")

            if not persona_id or not content:
                await websocket.send_text(
                    json.dumps({"type": "error", "content": "persona_id and content required"})
                )
                continue

            # 페르소나 조회
            persona = (
                sb.table("personas")
                .select("system_prompt")
                .eq("id", persona_id)
                .eq("user_id", user["id"])
                .limit(1)
                .execute()
            )
            if not persona.data:
                await websocket.send_text(
                    json.dumps({"type": "error", "content": "Persona not found"})
                )
                continue

            # 유저 메시지 DB 저장
            sb.table("chat_messages").insert({
                "thread_id": thread_id,
                "role": "user",
                "content": content,
            }).execute()

            # LangGraph 스트리밍 응답
            try:
                full_response = ""
                async for chunk in stream_chat(
                    system_prompt=persona.data[0]["system_prompt"],
                    user_message=content,
                    thread_id=thread_id,
                ):
                    full_response += chunk
                    await websocket.send_text(
                        json.dumps({"type": "stream", "content": chunk, "done": False})
                    )

                # 완료 신호
                await websocket.send_text(
                    json.dumps({"type": "stream", "content": "", "done": True})
                )

                # 어시스턴트 응답 DB 저장
                sb.table("chat_messages").insert({
                    "thread_id": thread_id,
                    "role": "assistant",
                    "content": full_response,
                }).execute()
            except Exception as e:
                await websocket.send_text(
                    json.dumps({"type": "error", "content": f"LLM error: {str(e)}"})
                )

    except WebSocketDisconnect:
        pass
