from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.deps import get_current_user
from core.supabase_client import get_supabase
from models.schemas import PersonaCreate, PersonaUpdate, PersonaResponse

router = APIRouter(prefix="/api/persona", tags=["persona"])

SYSTEM_PROMPT_TEMPLATE = """Your name is {name}. Always introduce yourself as {name} when asked who you are.

Personality: {personality}
Speaking style: {speaking_style}
Background: {background}

Always stay in character. Respond naturally as {name} would."""


def _build_system_prompt(data: dict) -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(
        name=data["name"],
        personality=data["personality"],
        speaking_style=data["speaking_style"],
        background=data.get("background") or "Not specified",
    )


@router.post("", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    body: PersonaCreate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    row = body.model_dump()
    row["user_id"] = user["id"]
    row["system_prompt"] = _build_system_prompt(row)

    result = sb.table("personas").insert(row).execute()
    return result.data[0]


@router.get("", response_model=list[PersonaResponse])
async def list_personas(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = (
        sb.table("personas")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    result = (
        sb.table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Persona not found")
    return result.data[0]


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: str,
    body: PersonaUpdate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()

    # 소유권 확인
    existing = (
        sb.table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Persona not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return existing.data[0]

    # 변경된 필드를 기존 데이터에 병합 후 system_prompt 재생성
    merged = {**existing.data[0], **updates}
    updates["system_prompt"] = _build_system_prompt(merged)

    result = (
        sb.table("personas")
        .update(updates)
        .eq("id", persona_id)
        .execute()
    )
    return result.data[0]


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()

    # 소유권 확인
    existing = (
        sb.table("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Persona not found")

    sb.table("personas").delete().eq("id", persona_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
