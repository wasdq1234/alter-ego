from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.deps import get_current_user
from core.supabase_client import get_supabase
from models.schemas import (
    FollowCreate,
    FollowResponse,
    PersonaProfileResponse,
    PostPersona,
)

router = APIRouter(prefix="/api/sns", tags=["follow"])

STORAGE_BUCKET = "persona-images"


def _verify_persona_ownership(sb, persona_id: str, user_id: str) -> None:
    """페르소나 소유권 검증."""
    result = (
        sb.table("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Not your persona")


def _get_profile_image(sb, persona_id: str) -> str | None:
    """프로필 이미지 URL 조회."""
    try:
        result = (
            sb.table("persona_images")
            .select("file_path")
            .eq("persona_id", persona_id)
            .eq("is_profile", True)
            .limit(1)
            .execute()
        )
        if result.data:
            return sb.storage.from_(STORAGE_BUCKET).get_public_url(
                result.data[0]["file_path"]
            )
    except Exception:
        pass
    return None


# --- Follow ---


@router.post(
    "/follow/{target_persona_id}",
    response_model=FollowResponse,
    status_code=status.HTTP_201_CREATED,
)
async def follow_persona(
    target_persona_id: str,
    body: FollowCreate,
    user: dict = Depends(get_current_user),
):
    """페르소나 팔로우."""
    sb = get_supabase()
    _verify_persona_ownership(sb, body.follower_id, user["id"])

    if body.follower_id == target_persona_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # 대상 페르소나 존재 확인
    target = (
        sb.table("personas")
        .select("id")
        .eq("id", target_persona_id)
        .limit(1)
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Target persona not found")

    # 이미 팔로우 중인지 확인
    existing = (
        sb.table("sns_follows")
        .select("id")
        .eq("follower_id", body.follower_id)
        .eq("following_id", target_persona_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Already following")

    result = sb.table("sns_follows").insert(
        {"follower_id": body.follower_id, "following_id": target_persona_id}
    ).execute()

    return result.data[0]


@router.delete("/follow/{target_persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_persona(
    target_persona_id: str,
    body: FollowCreate,
    user: dict = Depends(get_current_user),
):
    """페르소나 언팔로우."""
    sb = get_supabase()
    _verify_persona_ownership(sb, body.follower_id, user["id"])

    result = (
        sb.table("sns_follows")
        .select("id")
        .eq("follower_id", body.follower_id)
        .eq("following_id", target_persona_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Not following")

    sb.table("sns_follows").delete().eq("id", result.data[0]["id"]).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/persona/{persona_id}/followers", response_model=list[PostPersona])
async def get_followers(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    """팔로워 목록."""
    sb = get_supabase()

    result = (
        sb.table("sns_follows")
        .select("follower_id, personas!sns_follows_follower_id_fkey(id, name)")
        .eq("following_id", persona_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not result.data:
        return []

    persona_ids = [r["follower_id"] for r in result.data]
    image_map: dict[str, str] = {}
    try:
        img_result = (
            sb.table("persona_images")
            .select("persona_id, file_path")
            .in_("persona_id", persona_ids)
            .eq("is_profile", True)
            .execute()
        )
        image_map = {
            row["persona_id"]: sb.storage.from_(STORAGE_BUCKET).get_public_url(
                row["file_path"]
            )
            for row in img_result.data
        }
    except Exception:
        pass

    return [
        PostPersona(
            id=r["follower_id"],
            name=r.get("personas", {}).get("name", ""),
            profile_image_url=image_map.get(r["follower_id"]),
        )
        for r in result.data
    ]


@router.get("/persona/{persona_id}/following", response_model=list[PostPersona])
async def get_following(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    """팔로잉 목록."""
    sb = get_supabase()

    result = (
        sb.table("sns_follows")
        .select("following_id, personas!sns_follows_following_id_fkey(id, name)")
        .eq("follower_id", persona_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not result.data:
        return []

    persona_ids = [r["following_id"] for r in result.data]
    image_map: dict[str, str] = {}
    try:
        img_result = (
            sb.table("persona_images")
            .select("persona_id, file_path")
            .in_("persona_id", persona_ids)
            .eq("is_profile", True)
            .execute()
        )
        image_map = {
            row["persona_id"]: sb.storage.from_(STORAGE_BUCKET).get_public_url(
                row["file_path"]
            )
            for row in img_result.data
        }
    except Exception:
        pass

    return [
        PostPersona(
            id=r["following_id"],
            name=r.get("personas", {}).get("name", ""),
            profile_image_url=image_map.get(r["following_id"]),
        )
        for r in result.data
    ]


# --- Profile ---


@router.get("/persona/{persona_id}/profile", response_model=PersonaProfileResponse)
async def get_persona_profile(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    """공개 프로필 (포스트 수, 팔로워 수 등)."""
    sb = get_supabase()

    # 페르소나 기본 정보
    persona_result = (
        sb.table("personas")
        .select("id, name, personality, speaking_style, background")
        .eq("id", persona_id)
        .limit(1)
        .execute()
    )
    if not persona_result.data:
        raise HTTPException(status_code=404, detail="Persona not found")

    persona = persona_result.data[0]

    # 카운트 조회 (병렬은 아니지만 각각 exact count)
    post_count_result = (
        sb.table("sns_posts")
        .select("id", count="exact")
        .eq("persona_id", persona_id)
        .execute()
    )
    follower_count_result = (
        sb.table("sns_follows")
        .select("id", count="exact")
        .eq("following_id", persona_id)
        .execute()
    )
    following_count_result = (
        sb.table("sns_follows")
        .select("id", count="exact")
        .eq("follower_id", persona_id)
        .execute()
    )

    return PersonaProfileResponse(
        id=persona["id"],
        name=persona["name"],
        personality=persona["personality"],
        speaking_style=persona["speaking_style"],
        background=persona.get("background"),
        profile_image_url=_get_profile_image(sb, persona_id),
        post_count=post_count_result.count or 0,
        follower_count=follower_count_result.count or 0,
        following_count=following_count_result.count or 0,
    )
