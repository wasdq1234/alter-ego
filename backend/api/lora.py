"""LoRA training and status API endpoints."""

import io
import logging
import uuid
import zipfile

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from api.deps import get_current_user
from core.image_gen import get_training_status, start_lora_training
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/persona/{persona_id}/lora", tags=["lora"])

BUCKET = "persona-images"


# --- Request / Response schemas ---


class LoraTrainRequest(BaseModel):
    trigger_word: str = "ALTEREGO"
    steps: int = 1000


class LoraTrainResponse(BaseModel):
    training_id: str
    status: str
    trigger_word: str


class LoraStatusResponse(BaseModel):
    lora_status: str
    lora_model_id: str | None = None
    lora_trigger_word: str | None = None
    training_id: str | None = None
    logs: str | None = None


# --- Helpers ---


def _get_persona_for_owner(sb, persona_id: str, user_id: str) -> dict:
    """Fetch persona and verify ownership. Raises 404 if not found."""
    result = (
        sb.table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Persona not found")
    return result.data[0]


async def _build_training_zip(sb, persona_id: str) -> bytes:
    """Download all persona images and bundle into a ZIP archive."""
    images = (
        sb.table("persona_images")
        .select("file_path")
        .eq("persona_id", persona_id)
        .execute()
    )
    if not images.data or len(images.data) < 3:
        raise HTTPException(
            status_code=400,
            detail="At least 3 images are required to start LoRA training",
        )

    buf = io.BytesIO()
    async with httpx.AsyncClient() as http:
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, row in enumerate(images.data):
                url = sb.storage.from_(BUCKET).get_public_url(row["file_path"])
                resp = await http.get(url)
                if resp.status_code == 200:
                    ext = row["file_path"].rsplit(".", 1)[-1] if "." in row["file_path"] else "png"
                    zf.writestr(f"image_{i:03d}.{ext}", resp.content)
    buf.seek(0)
    return buf.read()


async def _poll_training_completion(
    persona_id: str,
    training_id: str,
    trigger_word: str,
    destination_model: str,
):
    """Background task: poll Replicate until training finishes, then update DB."""
    import asyncio

    sb = get_supabase()
    max_attempts = 360  # ~1 hour at 10s intervals
    for _ in range(max_attempts):
        await asyncio.sleep(10)
        try:
            result = await get_training_status(training_id)
        except Exception:
            logger.exception("Failed to poll training %s", training_id)
            continue

        if result["status"] == "succeeded":
            version = result.get("version", "")
            model_id = f"{destination_model}:{version}" if version else destination_model
            sb.table("personas").update(
                {
                    "lora_status": "ready",
                    "lora_model_id": model_id,
                    "lora_trigger_word": trigger_word,
                }
            ).eq("id", persona_id).execute()
            logger.info("LoRA training succeeded for persona %s", persona_id)
            return

        if result["status"] in ("failed", "canceled"):
            sb.table("personas").update(
                {"lora_status": "failed"}
            ).eq("id", persona_id).execute()
            logger.error(
                "LoRA training %s for persona %s: %s",
                result["status"], persona_id, result.get("logs", ""),
            )
            return

    # Timed out
    sb.table("personas").update(
        {"lora_status": "failed"}
    ).eq("id", persona_id).execute()
    logger.error("LoRA training timed out for persona %s", persona_id)


# --- Endpoints ---


@router.post("/train", response_model=LoraTrainResponse, status_code=status.HTTP_202_ACCEPTED)
async def train_lora(
    persona_id: str,
    body: LoraTrainRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Start LoRA training for a persona using its existing images."""
    sb = get_supabase()
    persona = _get_persona_for_owner(sb, persona_id, user["id"])

    # Prevent duplicate training
    if persona.get("lora_status") == "training":
        raise HTTPException(
            status_code=409,
            detail="LoRA training is already in progress",
        )

    # Build ZIP from persona images
    zip_bytes = await _build_training_zip(sb, persona_id)

    # Upload ZIP to Storage for a publicly accessible URL
    zip_path = f"lora-training/{persona_id}/{uuid.uuid4()}.zip"
    sb.storage.from_(BUCKET).upload(
        path=zip_path,
        file=zip_bytes,
        file_options={"content-type": "application/zip", "upsert": "true"},
    )
    zip_url = sb.storage.from_(BUCKET).get_public_url(zip_path)

    # Destination model on Replicate (user-scoped)
    safe_name = persona["name"].lower().replace(" ", "-")[:30]
    destination_model = f"alter-ego/{safe_name}-{persona_id[:8]}"

    # Start training via Replicate
    try:
        result = await start_lora_training(
            input_images_url=zip_url,
            trigger_word=body.trigger_word,
            destination_model=destination_model,
            steps=body.steps,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to start training: {e}")

    # Update persona status to 'training'
    sb.table("personas").update(
        {
            "lora_status": "training",
            "lora_trigger_word": body.trigger_word,
        }
    ).eq("id", persona_id).execute()

    # Poll for completion in background
    background_tasks.add_task(
        _poll_training_completion,
        persona_id,
        result["training_id"],
        body.trigger_word,
        destination_model,
    )

    return LoraTrainResponse(
        training_id=result["training_id"],
        status="training",
        trigger_word=body.trigger_word,
    )


@router.get("/status", response_model=LoraStatusResponse)
async def lora_status(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    """Check LoRA training status for a persona."""
    sb = get_supabase()
    persona = _get_persona_for_owner(sb, persona_id, user["id"])

    return LoraStatusResponse(
        lora_status=persona.get("lora_status", "pending"),
        lora_model_id=persona.get("lora_model_id"),
        lora_trigger_word=persona.get("lora_trigger_word"),
    )
