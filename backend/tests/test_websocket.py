import json
import pytest
from core.supabase_client import get_supabase


@pytest.fixture
def chat_setup(client, auth_headers, auth_token):
    """채팅 테스트용 페르소나 + 스레드 생성, 테스트 후 삭제."""
    sb = get_supabase()

    # 페르소나 생성
    resp = client.post("/api/persona", json={
        "name": "ws-test-bot",
        "personality": "Brief responder",
        "speaking_style": "One word answers",
    }, headers=auth_headers)
    persona = resp.json()

    # user_id 추출
    user_resp = sb.auth.get_user(auth_token)
    user_id = user_resp.user.id

    # 스레드 생성
    thread = sb.table("chat_threads").insert({
        "user_id": user_id,
        "persona_id": persona["id"],
        "title": "pytest ws test",
    }).execute()
    thread_id = thread.data[0]["id"]

    yield {
        "persona_id": persona["id"],
        "thread_id": thread_id,
        "token": auth_token,
    }

    # cleanup
    sb.table("chat_messages").delete().eq("thread_id", thread_id).execute()
    sb.table("chat_threads").delete().eq("id", thread_id).execute()
    sb.table("personas").delete().eq("id", persona["id"]).execute()


def test_websocket_rejects_no_token(client):
    """토큰 없이 WebSocket 연결 시 거부."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/chat/test-thread"):
            pass


def test_websocket_chat_streaming(client, chat_setup):
    """WebSocket 채팅 스트리밍 전체 플로우."""
    url = f"/ws/chat/{chat_setup['thread_id']}?token={chat_setup['token']}"

    with client.websocket_connect(url) as ws:
        ws.send_text(json.dumps({
            "persona_id": chat_setup["persona_id"],
            "content": "Say hello in one word.",
        }))

        chunks = []
        while True:
            raw = ws.receive_text()
            msg = json.loads(raw)
            assert msg["type"] == "stream"
            if msg["done"]:
                break
            chunks.append(msg["content"])

        full_response = "".join(chunks)
        assert len(chunks) > 0, "Should receive at least one chunk"
        assert len(full_response) > 0, "Response should not be empty"

    # DB에 메시지 저장 확인
    sb = get_supabase()
    msgs = (
        sb.table("chat_messages")
        .select("role")
        .eq("thread_id", chat_setup["thread_id"])
        .execute()
    )
    roles = [m["role"] for m in msgs.data]
    assert "user" in roles
    assert "assistant" in roles
