"""Activity command and log API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from api.deps import get_current_user
from core.activity import run_activity
from core.supabase_client import get_supabase

router = APIRouter(prefix="/api/persona", tags=["activity"])


# --- Schemas ---


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    activity_type: str
    content: str
    target_post_id: str | None = None
    target_persona_id: str | None = None
    image_url: str | None = None
    result: dict


class ActivityLogResponse(BaseModel):
    id: str
    persona_id: str
    activity_type: str
    detail: dict
    triggered_by: str
    created_at: str


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogResponse]
    next_cursor: str | None = None


# --- Helpers ---


def _verify_persona_ownership(sb, persona_id: str, user_id: str) -> None:
    """Verify persona belongs to the current user."""
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


# --- Endpoints ---


@router.post("/{persona_id}/command", response_model=CommandResponse)
async def send_command(
    persona_id: str,
    body: CommandRequest,
    user: dict = Depends(get_current_user),
):
    """Send a natural language command to a persona to perform an activity."""
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    result = await run_activity(
        persona_id=persona_id,
        command=body.command,
        triggered_by="manual",
        user_id=user["id"],
    )

    return CommandResponse(
        activity_type=result.get("activity_type", ""),
        content=result.get("content", ""),
        target_post_id=result.get("target_post_id") or None,
        target_persona_id=result.get("target_persona_id") or None,
        image_url=result.get("image_url") or None,
        result=result.get("result", {}),
    )


@router.get("/{persona_id}/activity-logs", response_model=ActivityLogListResponse)
async def get_activity_logs(
    persona_id: str,
    user: dict = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    activity_type: str | None = Query(default=None),
    triggered_by: str | None = Query(default=None),
):
    """Get activity logs for a persona with optional filters and cursor pagination."""
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    query = (
        sb.table("activity_logs")
        .select("*")
        .eq("persona_id", persona_id)
        .order("created_at", desc=True)
        .limit(limit + 1)
    )

    if cursor:
        query = query.lt("created_at", cursor)

    if activity_type:
        query = query.eq("activity_type", activity_type)

    if triggered_by:
        query = query.eq("triggered_by", triggered_by)

    result = query.execute()
    logs = result.data

    next_cursor = None
    if len(logs) > limit:
        logs = logs[:limit]
        next_cursor = logs[-1]["created_at"]

    items = [
        ActivityLogResponse(
            id=log["id"],
            persona_id=log["persona_id"],
            activity_type=log["activity_type"],
            detail=log.get("detail", {}),
            triggered_by=log.get("triggered_by", "manual"),
            created_at=log["created_at"],
        )
        for log in logs
    ]

    return ActivityLogListResponse(items=items, next_cursor=next_cursor)
