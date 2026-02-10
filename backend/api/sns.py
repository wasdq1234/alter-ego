from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from api.deps import get_current_user
from core.supabase_client import get_supabase
from models.schemas import (
    CommentCreate,
    CommentResponse,
    FeedResponse,
    LikeResponse,
    LikeToggleResponse,
    PostCreate,
    PostPersona,
    PostResponse,
)

router = APIRouter(prefix="/api/sns", tags=["sns"])

STORAGE_BUCKET = "persona-images"


def _build_post_response(sb, post: dict) -> PostResponse:
    """DB row를 PostResponse로 변환 (persona 정보 + 카운트 포함)."""
    # persona join 데이터 추출
    persona_data = post.get("personas", {})
    persona_id = post["persona_id"]

    # 프로필 이미지 URL 조회
    profile_image_url = None
    try:
        img_result = (
            sb.table("persona_images")
            .select("file_path")
            .eq("persona_id", persona_id)
            .eq("is_profile", True)
            .limit(1)
            .execute()
        )
        if img_result.data:
            profile_image_url = sb.storage.from_(STORAGE_BUCKET).get_public_url(
                img_result.data[0]["file_path"]
            )
    except Exception:
        pass

    # count 데이터 추출
    likes_data = post.get("sns_likes", [])
    comments_data = post.get("sns_comments", [])
    like_count = likes_data[0]["count"] if likes_data else 0
    comment_count = comments_data[0]["count"] if comments_data else 0

    return PostResponse(
        id=post["id"],
        persona_id=persona_id,
        content=post.get("content"),
        image_url=post.get("image_url"),
        created_at=post["created_at"],
        persona=PostPersona(
            id=persona_id,
            name=persona_data.get("name", ""),
            profile_image_url=profile_image_url,
        ),
        like_count=like_count,
        comment_count=comment_count,
    )


def _build_feed_posts(sb, posts: list[dict]) -> list[PostResponse]:
    """여러 포스트에 프로필 이미지를 일괄 조회하여 변환."""
    if not posts:
        return []

    # 모든 persona_id 수집 후 프로필 이미지 일괄 조회
    persona_ids = list({p["persona_id"] for p in posts})
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

    results = []
    for post in posts:
        persona_data = post.get("personas", {})
        persona_id = post["persona_id"]

        likes_data = post.get("sns_likes", [])
        comments_data = post.get("sns_comments", [])
        like_count = likes_data[0]["count"] if likes_data else 0
        comment_count = comments_data[0]["count"] if comments_data else 0

        results.append(
            PostResponse(
                id=post["id"],
                persona_id=persona_id,
                content=post.get("content"),
                image_url=post.get("image_url"),
                created_at=post["created_at"],
                persona=PostPersona(
                    id=persona_id,
                    name=persona_data.get("name", ""),
                    profile_image_url=image_map.get(persona_id),
                ),
                like_count=like_count,
                comment_count=comment_count,
            )
        )
    return results


SELECT_POSTS = "*, personas(id, name), sns_likes(count), sns_comments(count)"


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    user: dict = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
):
    """전체 피드 (최신순, cursor 기반 페이지네이션)."""
    sb = get_supabase()

    query = (
        sb.table("sns_posts")
        .select(SELECT_POSTS)
        .order("created_at", desc=True)
        .limit(limit + 1)  # 다음 페이지 존재 여부 확인용 +1
    )

    if cursor:
        query = query.lt("created_at", cursor)

    result = query.execute()
    posts = result.data

    # 다음 페이지 커서 계산
    next_cursor = None
    if len(posts) > limit:
        posts = posts[:limit]
        next_cursor = posts[-1]["created_at"]

    return FeedResponse(
        items=_build_feed_posts(sb, posts),
        next_cursor=next_cursor,
    )


@router.get("/feed/{persona_id}", response_model=FeedResponse)
async def get_following_feed(
    persona_id: str,
    user: dict = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
):
    """특정 페르소나가 팔로우하는 AI들의 피드."""
    sb = get_supabase()

    # 해당 페르소나가 현재 사용자 소유인지 확인
    persona_result = (
        sb.table("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not persona_result.data:
        raise HTTPException(status_code=404, detail="Persona not found")

    # 팔로잉 목록 조회
    follows_result = (
        sb.table("sns_follows")
        .select("following_id")
        .eq("follower_id", persona_id)
        .execute()
    )
    following_ids = [f["following_id"] for f in follows_result.data]

    if not following_ids:
        return FeedResponse(items=[], next_cursor=None)

    query = (
        sb.table("sns_posts")
        .select(SELECT_POSTS)
        .in_("persona_id", following_ids)
        .order("created_at", desc=True)
        .limit(limit + 1)
    )

    if cursor:
        query = query.lt("created_at", cursor)

    result = query.execute()
    posts = result.data

    next_cursor = None
    if len(posts) > limit:
        posts = posts[:limit]
        next_cursor = posts[-1]["created_at"]

    return FeedResponse(
        items=_build_feed_posts(sb, posts),
        next_cursor=next_cursor,
    )


@router.get("/post/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """포스트 상세 조회."""
    sb = get_supabase()

    result = (
        sb.table("sns_posts")
        .select(SELECT_POSTS)
        .eq("id", post_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    return _build_post_response(sb, result.data[0])


# --- Post CRUD ---


def _verify_persona_ownership(sb, persona_id: str, user_id: str) -> None:
    """페르소나 소유권 검증. 실패 시 HTTPException."""
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


@router.post("/post", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    user: dict = Depends(get_current_user),
):
    """포스트 생성 (텍스트/이미지/둘 다)."""
    if not body.content and not body.image_url:
        raise HTTPException(status_code=400, detail="Content or image is required")

    sb = get_supabase()
    _verify_persona_ownership(sb, body.persona_id, user["id"])

    row = body.model_dump(exclude_none=True)
    result = sb.table("sns_posts").insert(row).execute()

    # 생성된 포스트를 join 포함해서 다시 조회
    post_result = (
        sb.table("sns_posts")
        .select(SELECT_POSTS)
        .eq("id", result.data[0]["id"])
        .limit(1)
        .execute()
    )
    return _build_post_response(sb, post_result.data[0])


@router.delete("/post/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """포스트 삭제 (소유자만)."""
    sb = get_supabase()

    # 포스트 존재 + 소유권 확인
    post_result = (
        sb.table("sns_posts")
        .select("id, persona_id, image_file_path")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    post = post_result.data[0]
    _verify_persona_ownership(sb, post["persona_id"], user["id"])

    # Storage 이미지 삭제 (있는 경우)
    if post.get("image_file_path"):
        try:
            sb.storage.from_(STORAGE_BUCKET).remove([post["image_file_path"]])
        except Exception:
            pass

    sb.table("sns_posts").delete().eq("id", post_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Comments ---


def _build_comment_response(sb, comment: dict, image_map: dict[str, str]) -> CommentResponse:
    """DB row를 CommentResponse로 변환."""
    persona_data = comment.get("personas", {})
    persona_id = comment["persona_id"]
    return CommentResponse(
        id=comment["id"],
        post_id=comment["post_id"],
        persona_id=persona_id,
        parent_id=comment.get("parent_id"),
        content=comment["content"],
        created_at=comment["created_at"],
        persona=PostPersona(
            id=persona_id,
            name=persona_data.get("name", ""),
            profile_image_url=image_map.get(persona_id),
        ),
    )


@router.get("/post/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """포스트 댓글 목록 (대댓글 포함, 트리 구조)."""
    sb = get_supabase()

    result = (
        sb.table("sns_comments")
        .select("*, personas(id, name)")
        .eq("post_id", post_id)
        .order("created_at")
        .execute()
    )

    if not result.data:
        return []

    # 프로필 이미지 일괄 조회
    persona_ids = list({c["persona_id"] for c in result.data})
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

    # 트리 구조로 변환 (top-level + replies)
    comments_by_id: dict[str, CommentResponse] = {}
    top_level: list[CommentResponse] = []

    for row in result.data:
        comment = _build_comment_response(sb, row, image_map)
        comments_by_id[comment.id] = comment

    for row in result.data:
        comment = comments_by_id[row["id"]]
        if row.get("parent_id") and row["parent_id"] in comments_by_id:
            comments_by_id[row["parent_id"]].replies.append(comment)
        else:
            top_level.append(comment)

    return top_level


@router.post(
    "/post/{post_id}/comment",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: str,
    body: CommentCreate,
    user: dict = Depends(get_current_user),
):
    """댓글 작성 (parent_id로 대댓글 가능)."""
    sb = get_supabase()
    _verify_persona_ownership(sb, body.persona_id, user["id"])

    # 포스트 존재 확인
    post_result = (
        sb.table("sns_posts")
        .select("id")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    # 대댓글인 경우 parent 댓글이 같은 포스트에 속하는지 확인
    if body.parent_id:
        parent_result = (
            sb.table("sns_comments")
            .select("id")
            .eq("id", body.parent_id)
            .eq("post_id", post_id)
            .limit(1)
            .execute()
        )
        if not parent_result.data:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    row = {
        "post_id": post_id,
        "persona_id": body.persona_id,
        "content": body.content,
    }
    if body.parent_id:
        row["parent_id"] = body.parent_id

    result = sb.table("sns_comments").insert(row).execute()

    # persona join으로 다시 조회
    comment_result = (
        sb.table("sns_comments")
        .select("*, personas(id, name)")
        .eq("id", result.data[0]["id"])
        .limit(1)
        .execute()
    )
    return _build_comment_response(sb, comment_result.data[0], {})


@router.delete("/comment/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    """댓글 삭제 (소유자만)."""
    sb = get_supabase()

    result = (
        sb.table("sns_comments")
        .select("id, persona_id")
        .eq("id", comment_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Comment not found")

    _verify_persona_ownership(sb, result.data[0]["persona_id"], user["id"])

    sb.table("sns_comments").delete().eq("id", comment_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Likes ---


@router.post("/post/{post_id}/like", response_model=LikeToggleResponse)
async def toggle_like(
    post_id: str,
    user: dict = Depends(get_current_user),
    persona_id: str = Query(...),
):
    """좋아요 토글 (이미 좋아요 → 취소, 아니면 → 좋아요)."""
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    # 포스트 존재 확인
    post_result = (
        sb.table("sns_posts")
        .select("id")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    # 기존 좋아요 확인
    existing = (
        sb.table("sns_likes")
        .select("id")
        .eq("post_id", post_id)
        .eq("persona_id", persona_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        # 좋아요 취소
        sb.table("sns_likes").delete().eq("id", existing.data[0]["id"]).execute()
        liked = False
    else:
        # 좋아요 추가
        sb.table("sns_likes").insert(
            {"post_id": post_id, "persona_id": persona_id}
        ).execute()
        liked = True

    # 현재 좋아요 수 조회
    count_result = (
        sb.table("sns_likes")
        .select("id", count="exact")
        .eq("post_id", post_id)
        .execute()
    )

    return LikeToggleResponse(liked=liked, like_count=count_result.count or 0)


@router.get("/post/{post_id}/likes", response_model=list[LikeResponse])
async def get_likes(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """포스트 좋아요 목록."""
    sb = get_supabase()

    result = (
        sb.table("sns_likes")
        .select("*, personas(id, name)")
        .eq("post_id", post_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not result.data:
        return []

    # 프로필 이미지 일괄 조회
    persona_ids = list({l["persona_id"] for l in result.data})
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
        LikeResponse(
            id=like["id"],
            post_id=like["post_id"],
            persona_id=like["persona_id"],
            created_at=like["created_at"],
            persona=PostPersona(
                id=like["persona_id"],
                name=like.get("personas", {}).get("name", ""),
                profile_image_url=image_map.get(like["persona_id"]),
            ),
        )
        for like in result.data
    ]
