import pytest
from core.supabase_client import get_supabase


@pytest.fixture
def persona_data():
    return {
        "name": "pytest-bot",
        "personality": "Helpful and concise",
        "speaking_style": "Formal, polite",
        "background": "A test persona for pytest",
    }


@pytest.fixture
def created_persona(client, auth_headers, persona_data):
    """페르소나 생성 후 테스트에 제공, 테스트 후 삭제."""
    resp = client.post("/api/persona", json=persona_data, headers=auth_headers)
    assert resp.status_code == 201
    persona = resp.json()
    yield persona
    # cleanup
    get_supabase().table("personas").delete().eq("id", persona["id"]).execute()


def test_create_persona(created_persona, persona_data):
    """페르소나 생성 확인."""
    assert created_persona["name"] == persona_data["name"]
    assert created_persona["system_prompt"] is not None
    assert len(created_persona["system_prompt"]) > 0


def test_list_personas(client, auth_headers, created_persona):
    """페르소나 목록에 생성한 페르소나가 포함."""
    resp = client.get("/api/persona", headers=auth_headers)
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert created_persona["id"] in ids


def test_get_persona(client, auth_headers, created_persona):
    """페르소나 단건 조회."""
    resp = client.get(f"/api/persona/{created_persona['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == created_persona["name"]


def test_update_persona(client, auth_headers, created_persona):
    """페르소나 수정 후 반영 확인."""
    resp = client.put(
        f"/api/persona/{created_persona['id']}",
        json={"name": "updated-bot"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "updated-bot"
    assert "updated-bot" in resp.json()["system_prompt"]


def test_get_nonexistent_persona(client, auth_headers):
    """존재하지 않는 페르소나 → 404."""
    resp = client.get(
        "/api/persona/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert resp.status_code == 404
