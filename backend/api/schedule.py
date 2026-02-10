from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.deps import get_current_user
from core.scheduler import add_schedule_job, remove_schedule_job
from core.supabase_client import get_supabase
from models.schemas import ScheduleCreate, ScheduleUpdate, ScheduleResponse

router = APIRouter(prefix="/api/persona", tags=["schedule"])


def _verify_persona_ownership(sb, persona_id: str, user_id: str) -> None:
    """페르소나 소유권 확인. 본인 소유가 아니면 404."""
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


@router.post(
    "/{persona_id}/schedule",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_schedule(
    persona_id: str,
    body: ScheduleCreate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    row = body.model_dump()
    row["persona_id"] = persona_id
    row["user_id"] = user["id"]

    result = sb.table("activity_schedules").insert(row).execute()
    schedule = result.data[0]
    if schedule.get("is_active", True):
        add_schedule_job(schedule)
    return schedule


@router.get("/{persona_id}/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    result = (
        sb.table("activity_schedules")
        .select("*")
        .eq("persona_id", persona_id)
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.put("/{persona_id}/schedule/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    persona_id: str,
    schedule_id: str,
    body: ScheduleUpdate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    # 스케줄 존재 확인
    existing = (
        sb.table("activity_schedules")
        .select("*")
        .eq("id", schedule_id)
        .eq("persona_id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Schedule not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing.data[0]

    result = (
        sb.table("activity_schedules")
        .update(updates)
        .eq("id", schedule_id)
        .execute()
    )
    updated = result.data[0]
    if updated.get("is_active", False):
        add_schedule_job(updated)
    else:
        remove_schedule_job(schedule_id)
    return updated


@router.delete(
    "/{persona_id}/schedule/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_schedule(
    persona_id: str,
    schedule_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    _verify_persona_ownership(sb, persona_id, user["id"])

    # 스케줄 존재 확인
    existing = (
        sb.table("activity_schedules")
        .select("id")
        .eq("id", schedule_id)
        .eq("persona_id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Schedule not found")

    remove_schedule_job(schedule_id)
    sb.table("activity_schedules").delete().eq("id", schedule_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
