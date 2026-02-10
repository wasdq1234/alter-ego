"""Tests for activity command and log API."""

import pytest
from core.supabase_client import get_supabase


@pytest.fixture
def persona_data():
    return {
        "name": "activity-test-bot",
        "personality": "Energetic and social",
        "speaking_style": "Casual, fun",
        "background": "A test persona for activity tests",
    }


@pytest.fixture
def created_persona(client, auth_headers, persona_data):
    """페르소나 생성 후 테스트에 제공, 테스트 후 삭제."""
    resp = client.post("/api/persona", json=persona_data, headers=auth_headers)
    assert resp.status_code == 201
    persona = resp.json()
    yield persona
    get_supabase().table("personas").delete().eq("id", persona["id"]).execute()


def test_activity_logs_empty(client, auth_headers, created_persona):
    """활동 로그가 비어있는 상태."""
    resp = client.get(
        f"/api/persona/{created_persona['id']}/activity-logs",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["next_cursor"] is None


def test_activity_logs_nonexistent_persona(client, auth_headers):
    """존재하지 않는 페르소나 → 403."""
    resp = client.get(
        "/api/persona/00000000-0000-0000-0000-000000000000/activity-logs",
        headers=auth_headers,
    )
    assert resp.status_code == 403


def test_command_nonexistent_persona(client, auth_headers):
    """존재하지 않는 페르소나에 커맨드 → 403."""
    resp = client.post(
        "/api/persona/00000000-0000-0000-0000-000000000000/command",
        json={"command": "test"},
        headers=auth_headers,
    )
    assert resp.status_code == 403


def test_command_no_auth(client, created_persona):
    """인증 없이 커맨드 → 401/403."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/command",
        json={"command": "test"},
    )
    assert resp.status_code in (401, 403)


def test_activity_logs_no_auth(client, created_persona):
    """인증 없이 로그 조회 → 401/403."""
    resp = client.get(
        f"/api/persona/{created_persona['id']}/activity-logs",
    )
    assert resp.status_code in (401, 403)
