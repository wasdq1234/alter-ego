import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from openai import OpenAI
from pydantic import BaseModel

from api.deps import get_current_user
from core.supabase_client import get_supabase

router = APIRouter(prefix="/api/persona/{persona_id}/image", tags=["image"])

BUCKET = "persona-images"


class ImageGenerateRequest(BaseModel):
    prompt: str


class ImageResponse(BaseModel):
    id: str
    persona_id: str
    file_path: str
    prompt: str
    is_profile: bool
    created_at: str
    url: str


def _image_url(file_path: str) -> str:
    sb = get_supabase()
    return sb.storage.from_(BUCKET).get_public_url(file_path)


def _row_to_response(row: dict) -> ImageResponse:
    return ImageResponse(
        **row,
        url=_image_url(row["file_path"]),
    )


def _verify_ownership(sb, persona_id: str, user_id: str):
    """페르소나 소유권 확인."""
    result = (
        sb.table("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Persona not found")


@router.post("/generate", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def generate_image(
    persona_id: str,
    body: ImageGenerateRequest,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_ownership(sb, persona_id, user["id"])

    # OpenAI DALL-E 이미지 생성
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    try:
        result = client.images.generate(
            model="dall-e-3",
            prompt=body.prompt,
            size="1024x1024",
            n=1,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {e}")

    image_url = result.data[0].url

    # 이미지 다운로드
    async with httpx.AsyncClient() as http:
        resp = await http.get(image_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to download generated image")
        image_bytes = resp.content

    # Supabase Storage에 업로드
    file_id = str(uuid.uuid4())
    file_name = f"images/{file_id}.png"

    sb.storage.from_(BUCKET).upload(
        path=file_name,
        file=image_bytes,
        file_options={"content-type": "image/png", "upsert": "false"},
    )

    # 기존 프로필 이미지 존재 여부 확인
    existing = (
        sb.table("persona_images")
        .select("id")
        .eq("persona_id", persona_id)
        .eq("is_profile", True)
        .limit(1)
        .execute()
    )
    is_profile = len(existing.data) == 0

    # DB 저장
    row = {
        "persona_id": persona_id,
        "user_id": user["id"],
        "file_path": file_name,
        "prompt": body.prompt,
        "is_profile": is_profile,
    }
    insert_result = sb.table("persona_images").insert(row).execute()
    return _row_to_response(insert_result.data[0])


@router.get("s", response_model=list[ImageResponse])
async def list_images(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_ownership(sb, persona_id, user["id"])

    result = (
        sb.table("persona_images")
        .select("*")
        .eq("persona_id", persona_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_response(row) for row in result.data]


@router.put("/{image_id}/set-profile", response_model=ImageResponse)
async def set_profile_image(
    persona_id: str,
    image_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_ownership(sb, persona_id, user["id"])

    # 대상 이미지 존재 확인
    target = (
        sb.table("persona_images")
        .select("*")
        .eq("id", image_id)
        .eq("persona_id", persona_id)
        .limit(1)
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Image not found")

    # 기존 프로필 해제
    sb.table("persona_images").update({"is_profile": False}).eq(
        "persona_id", persona_id
    ).eq("is_profile", True).execute()

    # 새 프로필 설정
    result = (
        sb.table("persona_images")
        .update({"is_profile": True})
        .eq("id", image_id)
        .execute()
    )
    return _row_to_response(result.data[0])


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    persona_id: str,
    image_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_ownership(sb, persona_id, user["id"])

    # 대상 이미지 확인
    target = (
        sb.table("persona_images")
        .select("*")
        .eq("id", image_id)
        .eq("persona_id", persona_id)
        .limit(1)
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Image not found")

    was_profile = target.data[0]["is_profile"]
    file_path = target.data[0]["file_path"]

    # DB 삭제
    sb.table("persona_images").delete().eq("id", image_id).execute()

    # Supabase Storage에서 삭제
    sb.storage.from_(BUCKET).remove([file_path])

    # 프로필이었으면 다른 이미지를 자동 승격
    if was_profile:
        remaining = (
            sb.table("persona_images")
            .select("id")
            .eq("persona_id", persona_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if remaining.data:
            sb.table("persona_images").update({"is_profile": True}).eq(
                "id", remaining.data[0]["id"]
            ).execute()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
