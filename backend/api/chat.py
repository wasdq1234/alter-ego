import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.supabase_client import get_supabase
from core.graph import stream_chat

router = APIRouter(tags=["chat"])


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
                .maybe_single()
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
            full_response = ""
            async for chunk in stream_chat(
                system_prompt=persona.data["system_prompt"],
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

    except WebSocketDisconnect:
        pass
