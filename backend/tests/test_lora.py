"""Tests for LoRA training/status API and image_gen module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from core.supabase_client import get_supabase


# --- Fixtures ---


@pytest.fixture
def persona_data():
    return {
        "name": "lora-test-bot",
        "personality": "Creative and artistic",
        "speaking_style": "Casual, friendly",
        "background": "A test persona for LoRA tests",
    }


@pytest.fixture
def created_persona(client, auth_headers, persona_data):
    """페르소나 생성 후 테스트에 제공, 테스트 후 삭제."""
    resp = client.post("/api/persona", json=persona_data, headers=auth_headers)
    assert resp.status_code == 201
    persona = resp.json()
    yield persona
    get_supabase().table("personas").delete().eq("id", persona["id"]).execute()


# --- LoRA Status API Tests ---


def test_lora_status_default_pending(client, auth_headers, created_persona):
    """새 페르소나의 기본 LoRA 상태는 pending."""
    resp = client.get(
        f"/api/persona/{created_persona['id']}/lora/status",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["lora_status"] == "pending"
    assert data["lora_model_id"] is None
    assert data["lora_trigger_word"] is None


def test_lora_status_not_found(client, auth_headers):
    """존재하지 않는 페르소나 → 404."""
    resp = client.get(
        "/api/persona/00000000-0000-0000-0000-000000000000/lora/status",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_lora_status_no_auth(client, created_persona):
    """인증 없이 상태 조회 → 401."""
    resp = client.get(
        f"/api/persona/{created_persona['id']}/lora/status",
    )
    assert resp.status_code == 401


# --- LoRA Train API Tests ---


def test_train_insufficient_images(client, auth_headers, created_persona):
    """이미지 3장 미만 시 400 에러."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/lora/train",
        json={"trigger_word": "TESTBOT", "steps": 500},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "3 images" in resp.json()["detail"]


def test_train_not_found(client, auth_headers):
    """존재하지 않는 페르소나 → 404."""
    resp = client.post(
        "/api/persona/00000000-0000-0000-0000-000000000000/lora/train",
        json={"trigger_word": "TESTBOT"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_train_no_auth(client, created_persona):
    """인증 없이 학습 시작 → 401."""
    resp = client.post(
        f"/api/persona/{created_persona['id']}/lora/train",
        json={"trigger_word": "TESTBOT"},
    )
    assert resp.status_code == 401


def test_train_duplicate_rejected(client, auth_headers, created_persona):
    """이미 training 중이면 409 conflict."""
    sb = get_supabase()
    sb.table("personas").update(
        {"lora_status": "training"}
    ).eq("id", created_persona["id"]).execute()

    try:
        resp = client.post(
            f"/api/persona/{created_persona['id']}/lora/train",
            json={"trigger_word": "TESTBOT"},
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert "already in progress" in resp.json()["detail"]
    finally:
        sb.table("personas").update(
            {"lora_status": "pending"}
        ).eq("id", created_persona["id"]).execute()


# --- image_gen module unit tests (mocked Replicate) ---


class TestImageGenModule:
    @pytest.mark.asyncio
    async def test_start_lora_training_calls_replicate(self):
        """start_lora_training이 replicate.trainings.create를 호출."""
        mock_training = MagicMock()
        mock_training.id = "train_abc123"
        mock_training.status = "starting"

        with patch("core.image_gen.replicate") as mock_replicate:
            mock_replicate.trainings.create.return_value = mock_training

            from core.image_gen import start_lora_training

            result = await start_lora_training(
                input_images_url="https://example.com/images.zip",
                trigger_word="TESTBOT",
                destination_model="alter-ego/test-model",
                steps=500,
            )

            assert result["training_id"] == "train_abc123"
            assert result["status"] == "starting"
            assert result["model"] == "alter-ego/test-model"
            mock_replicate.trainings.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_training_status_succeeded(self):
        """학습 성공 시 version 정보가 포함."""
        mock_training = MagicMock()
        mock_training.id = "train_abc123"
        mock_training.status = "succeeded"
        mock_training.logs = "Step 1000/1000 completed"
        mock_training.output = {"version": "abc123def456"}

        with patch("core.image_gen.replicate") as mock_replicate:
            mock_replicate.trainings.get.return_value = mock_training

            from core.image_gen import get_training_status

            result = await get_training_status("train_abc123")

            assert result["status"] == "succeeded"
            assert result["version"] == "abc123def456"
            assert "Step 1000" in result["logs"]

    @pytest.mark.asyncio
    async def test_get_training_status_failed(self):
        """학습 실패 시 version 없음."""
        mock_training = MagicMock()
        mock_training.id = "train_abc123"
        mock_training.status = "failed"
        mock_training.logs = "Error: out of memory"
        mock_training.output = None

        with patch("core.image_gen.replicate") as mock_replicate:
            mock_replicate.trainings.get.return_value = mock_training

            from core.image_gen import get_training_status

            result = await get_training_status("train_abc123")

            assert result["status"] == "failed"
            assert "version" not in result
            assert "out of memory" in result["logs"]

    @pytest.mark.asyncio
    async def test_generate_lora_image_returns_urls(self):
        """generate_lora_image가 이미지 URL 리스트를 반환."""
        mock_output_item = MagicMock()
        mock_output_item.url = "https://replicate.delivery/output1.png"

        with patch("core.image_gen.replicate") as mock_replicate:
            mock_replicate.async_run = AsyncMock(return_value=[mock_output_item])

            from core.image_gen import generate_lora_image

            result = await generate_lora_image(
                lora_model="alter-ego/test-model:abc123",
                prompt="TESTBOT sitting at a cafe",
            )

            assert len(result) == 1
            assert "output1.png" in result[0]
            mock_replicate.async_run.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_lora_image_string_fallback(self):
        """FileOutput에 url 속성이 없을 때 str() 폴백."""
        with patch("core.image_gen.replicate") as mock_replicate:
            mock_replicate.async_run = AsyncMock(
                return_value=["https://replicate.delivery/output1.png"]
            )

            from core.image_gen import generate_lora_image

            result = await generate_lora_image(
                lora_model="alter-ego/test-model:abc123",
                prompt="TESTBOT walking in park",
            )

            assert len(result) == 1
            assert "output1.png" in result[0]
