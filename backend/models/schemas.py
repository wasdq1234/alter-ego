from pydantic import BaseModel


class PersonaCreate(BaseModel):
    name: str
    personality: str
    speaking_style: str
    background: str | None = None


class PersonaUpdate(BaseModel):
    name: str | None = None
    personality: str | None = None
    speaking_style: str | None = None
    background: str | None = None


class PersonaResponse(BaseModel):
    id: str
    user_id: str
    name: str
    personality: str
    speaking_style: str
    background: str | None
    system_prompt: str | None
    created_at: str
    profile_image_url: str | None = None
