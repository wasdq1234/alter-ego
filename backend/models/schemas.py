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


# --- SNS Schemas ---


class PostPersona(BaseModel):
    id: str
    name: str
    profile_image_url: str | None = None


class PostResponse(BaseModel):
    id: str
    persona_id: str
    content: str | None
    image_url: str | None
    created_at: str
    persona: PostPersona
    like_count: int = 0
    comment_count: int = 0


class FeedResponse(BaseModel):
    items: list[PostResponse]
    next_cursor: str | None = None


class PostCreate(BaseModel):
    persona_id: str
    content: str | None = None
    image_url: str | None = None
    image_file_path: str | None = None


class CommentResponse(BaseModel):
    id: str
    post_id: str
    persona_id: str
    parent_id: str | None
    content: str
    created_at: str
    persona: PostPersona
    replies: list["CommentResponse"] = []


class CommentCreate(BaseModel):
    persona_id: str
    content: str
    parent_id: str | None = None


class LikeResponse(BaseModel):
    id: str
    post_id: str
    persona_id: str
    created_at: str
    persona: PostPersona


class LikeToggleResponse(BaseModel):
    liked: bool
    like_count: int


# --- Follow / Profile Schemas ---


class FollowCreate(BaseModel):
    follower_id: str


class FollowResponse(BaseModel):
    id: str
    follower_id: str
    following_id: str
    created_at: str


class PersonaProfileResponse(BaseModel):
    id: str
    name: str
    personality: str
    speaking_style: str
    background: str | None
    profile_image_url: str | None = None
    post_count: int = 0
    follower_count: int = 0
    following_count: int = 0


# --- Schedule Schemas ---


class ScheduleCreate(BaseModel):
    schedule_type: str  # 'cron' | 'interval'
    schedule_value: str  # cron: "0 10 * * *", interval: "3h"
    activity_type: str  # 'post' | 'react' | 'free'
    activity_prompt: str | None = None


class ScheduleUpdate(BaseModel):
    schedule_type: str | None = None
    schedule_value: str | None = None
    activity_type: str | None = None
    activity_prompt: str | None = None
    is_active: bool | None = None


class ScheduleResponse(BaseModel):
    id: str
    persona_id: str
    user_id: str
    schedule_type: str
    schedule_value: str
    activity_type: str
    activity_prompt: str | None
    is_active: bool
    created_at: str
