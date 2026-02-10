"""Tests for schedule CRUD API."""

import pytest
from core.supabase_client import get_supabase


@pytest.fixture
def persona_data():
    return {
        "name": "schedule-test-bot",
        "personality": "Punctual and organized",
        "speaking_style": "Professional",
        "background": "A test persona for schedule tests",
    }


@pytest.fixture
def created_persona(client, auth_headers, persona_data):
    """페르소나 생성 후 테스트에 제공, 테스트 후 삭제."""
    resp = client.post("/api/persona", json=persona_data, headers=auth_headers)
    assert resp.status_code == 201
    persona = resp.json()
    yield persona
    get_supabase().table("personas").delete().eq("id", persona["id"]).execute()


@pytest.fixture
def schedule_data():
    return {
        "schedule_type": "interval",
        "schedule_value": "3h",
        "activity_type": "post",
        "activity_prompt": "일상 포스트를 작성해줘",
    }


def test_create_schedule(client, auth_headers, created_persona, schedule_data):
    """스케줄 생성."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/schedule",
        json=schedule_data,
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["schedule_type"] == "interval"
    assert data["schedule_value"] == "3h"
    assert data["activity_type"] == "post"
    assert data["is_active"] is True

    # cleanup
    get_supabase().table("activity_schedules").delete().eq("id", data["id"]).execute()


def test_list_schedules(client, auth_headers, created_persona, schedule_data):
    """스케줄 목록 조회."""
    # 생성
    resp = client.post(
        f"/api/persona/{created_persona['id']}/schedule",
        json=schedule_data,
        headers=auth_headers,
    )
    assert resp.status_code == 201
    schedule_id = resp.json()["id"]

    # 목록
    resp = client.get(
        f"/api/persona/{created_persona['id']}/schedules",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert schedule_id in ids

    # cleanup
    get_supabase().table("activity_schedules").delete().eq("id", schedule_id).execute()


def test_update_schedule(client, auth_headers, created_persona, schedule_data):
    """스케줄 수정."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/schedule",
        json=schedule_data,
        headers=auth_headers,
    )
    assert resp.status_code == 201
    schedule_id = resp.json()["id"]

    resp = client.put(
        f"/api/persona/{created_persona['id']}/schedule/{schedule_id}",
        json={"schedule_value": "6h", "is_active": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["schedule_value"] == "6h"
    assert resp.json()["is_active"] is False

    # cleanup
    get_supabase().table("activity_schedules").delete().eq("id", schedule_id).execute()


def test_delete_schedule(client, auth_headers, created_persona, schedule_data):
    """스케줄 삭제."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/schedule",
        json=schedule_data,
        headers=auth_headers,
    )
    assert resp.status_code == 201
    schedule_id = resp.json()["id"]

    resp = client.delete(
        f"/api/persona/{created_persona['id']}/schedule/{schedule_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204


def test_schedule_nonexistent_persona(client, auth_headers, schedule_data):
    """존재하지 않는 페르소나 → 404."""
    resp = client.post(
        "/api/persona/00000000-0000-0000-0000-000000000000/schedule",
        json=schedule_data,
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_schedule_no_auth(client, created_persona, schedule_data):
    """인증 없이 → 401/403."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/schedule",
        json=schedule_data,
    )
    assert resp.status_code in (401, 403)
