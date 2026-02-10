"""LangGraph activity decision engine for autonomous persona actions."""

import json
import logging
import os
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from core.image_gen import generate_lora_image, upload_image_to_storage
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class ActivityState(TypedDict):
    persona_id: str
    command: str  # natural language command or schedule trigger description
    triggered_by: str  # 'manual', 'schedule', 'auto'
    user_id: str
    # Collected context
    persona: dict
    recent_posts: list
    recent_logs: list
    # Decision
    activity_type: str  # 'post', 'comment', 'like', 'follow'
    content: str  # generated text content
    target_post_id: str  # for comment/like
    target_persona_id: str  # for follow
    needs_image: bool
    image_url: str  # generated image URL
    # Result
    result: dict


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------

DECISION_SYSTEM_PROMPT = """\
You are the autonomous brain of an AI persona on a social network.
You must decide what action to take based on the persona's identity and the current context.

Persona info:
- Name: {name}
- Personality: {personality}
- Speaking style: {speaking_style}
- Background: {background}

Available actions:
1. "post" — Write a new SNS post (text, optionally with image)
2. "comment" — Leave a comment on an existing post
3. "like" — Like an existing post
4. "follow" — Follow another persona

Respond with ONLY a JSON object (no markdown, no explanation) in this format:
{{
  "activity_type": "post" | "comment" | "like" | "follow",
  "content": "the text content to post or comment (empty string if like/follow)",
  "target_post_id": "post id to comment on or like (empty string if not applicable)",
  "target_persona_id": "persona id to follow (empty string if not applicable)",
  "needs_image": true | false
}}

Rules:
- Pick an action that fits the command/situation and the persona's character.
- Write content in the persona's speaking style and personality.
- Only set needs_image to true for posts where a visual would add value.
- For "comment" or "like", pick a post from the recent posts provided.
- For "follow", pick from personas visible in recent posts that are not already followed.
- If no suitable target exists for comment/like/follow, fall back to creating a "post".
"""


def _build_decision_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-4o"),
        temperature=0.8,
    )


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


async def collect_context(state: ActivityState) -> dict:
    """Query DB for persona info, recent feed posts, and recent activity logs."""
    sb = get_supabase()
    persona_id = state["persona_id"]

    # Fetch persona
    persona_result = (
        sb.table("personas")
        .select("id, name, personality, speaking_style, background, system_prompt")
        .eq("id", persona_id)
        .limit(1)
        .execute()
    )
    persona = persona_result.data[0] if persona_result.data else {}

    # Fetch recent feed posts (from followed personas + global recent)
    follows_result = (
        sb.table("sns_follows")
        .select("following_id")
        .eq("follower_id", persona_id)
        .execute()
    )
    following_ids = [f["following_id"] for f in follows_result.data]

    if following_ids:
        posts_result = (
            sb.table("sns_posts")
            .select("id, persona_id, content, image_url, created_at, personas(id, name)")
            .in_("persona_id", following_ids)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_posts = posts_result.data
    else:
        # No follows yet — show recent global posts (exclude own)
        posts_result = (
            sb.table("sns_posts")
            .select("id, persona_id, content, image_url, created_at, personas(id, name)")
            .neq("persona_id", persona_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_posts = posts_result.data

    # Fetch recent activity logs
    logs_result = (
        sb.table("activity_logs")
        .select("id, activity_type, detail, triggered_by, created_at")
        .eq("persona_id", persona_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    recent_logs = logs_result.data

    return {
        "persona": persona,
        "recent_posts": recent_posts,
        "recent_logs": recent_logs,
    }


async def decide_activity(state: ActivityState) -> dict:
    """Call LLM to decide what action to take based on command + context."""
    persona = state["persona"]
    llm = _build_decision_llm()

    system_msg = DECISION_SYSTEM_PROMPT.format(
        name=persona.get("name", "Unknown"),
        personality=persona.get("personality", ""),
        speaking_style=persona.get("speaking_style", ""),
        background=persona.get("background", ""),
    )

    # Build context summary for the LLM
    posts_summary = ""
    for p in state.get("recent_posts", [])[:10]:
        author = p.get("personas", {}).get("name", "unknown")
        posts_summary += f"- [id:{p['id']}] by {author} (persona:{p['persona_id']}): {(p.get('content') or '(image only)')[:100]}\n"

    logs_summary = ""
    for log in state.get("recent_logs", [])[:5]:
        detail = log.get("detail", {})
        content = detail.get("content", "") if isinstance(detail, dict) else ""
        logs_summary += f"- {log['activity_type']}: {(content or '')[:80]} ({log['created_at']})\n"

    user_msg = (
        f"Command: {state['command']}\n"
        f"Triggered by: {state['triggered_by']}\n\n"
        f"Recent feed posts:\n{posts_summary or '(no posts yet)'}\n\n"
        f"My recent activity:\n{logs_summary or '(no recent activity)'}\n\n"
        f"Decide what to do now."
    )

    response = await llm.ainvoke([
        SystemMessage(content=system_msg),
        HumanMessage(content=user_msg),
    ])

    # Parse JSON from LLM response
    raw = response.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        decision = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: default to a simple post
        decision = {
            "activity_type": "post",
            "content": f"({state['command']})",
            "target_post_id": "",
            "target_persona_id": "",
            "needs_image": False,
        }

    return {
        "activity_type": decision.get("activity_type", "post"),
        "content": decision.get("content", ""),
        "target_post_id": decision.get("target_post_id", ""),
        "target_persona_id": decision.get("target_persona_id", ""),
        "needs_image": bool(decision.get("needs_image", False)),
    }


def check_image(state: ActivityState) -> Literal["generate_image", "execute_action"]:
    """Router: decide whether to generate an image."""
    if state.get("needs_image") and state.get("activity_type") == "post":
        return "generate_image"
    return "execute_action"


async def generate_image(state: ActivityState) -> dict:
    """Generate an image using LoRA (if available) or DALL-E fallback, then upload."""
    persona = state["persona"]
    persona_id = state["persona_id"]
    user_id = state["user_id"]

    # Check if persona has a trained LoRA model
    sb = get_supabase()
    lora_result = (
        sb.table("persona_images")
        .select("lora_model")
        .eq("persona_id", persona_id)
        .neq("lora_model", None)
        .limit(1)
        .execute()
    )

    prompt = f"A photo of {persona.get('name', 'someone')}: {state['content'][:200]}"
    image_url = ""

    try:
        if lora_result.data and lora_result.data[0].get("lora_model"):
            # Use LoRA model
            lora_model = lora_result.data[0]["lora_model"]
            urls = await generate_lora_image(lora_model=lora_model, prompt=prompt)
            if urls:
                upload_result = await upload_image_to_storage(urls[0], persona_id, user_id)
                image_url = upload_result["public_url"]
        else:
            # DALL-E fallback via OpenAI
            from openai import AsyncOpenAI

            client = AsyncOpenAI()
            dalle_response = await client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                n=1,
                size="1024x1024",
            )
            if dalle_response.data:
                remote_url = dalle_response.data[0].url
                upload_result = await upload_image_to_storage(
                    remote_url, persona_id, user_id
                )
                image_url = upload_result["public_url"]
    except Exception:
        # Image generation failed — proceed without image
        pass

    return {"image_url": image_url}


async def execute_action(state: ActivityState) -> dict:
    """Execute the decided action via Supabase."""
    sb = get_supabase()
    activity_type = state.get("activity_type", "post")
    persona_id = state["persona_id"]
    result = {}

    if activity_type == "post":
        row = {"persona_id": persona_id, "content": state.get("content", "")}
        if state.get("image_url"):
            row["image_url"] = state["image_url"]
        insert_result = sb.table("sns_posts").insert(row).execute()
        result = {"post_id": insert_result.data[0]["id"]} if insert_result.data else {}

    elif activity_type == "comment":
        target_post_id = state.get("target_post_id", "")
        if not target_post_id:
            # Fallback to post if no target
            row = {"persona_id": persona_id, "content": state.get("content", "")}
            insert_result = sb.table("sns_posts").insert(row).execute()
            result = {"post_id": insert_result.data[0]["id"]} if insert_result.data else {}
        else:
            row = {
                "post_id": target_post_id,
                "persona_id": persona_id,
                "content": state.get("content", ""),
            }
            insert_result = sb.table("sns_comments").insert(row).execute()
            result = {"comment_id": insert_result.data[0]["id"]} if insert_result.data else {}

    elif activity_type == "like":
        target_post_id = state.get("target_post_id", "")
        if target_post_id:
            # Check if already liked
            existing = (
                sb.table("sns_likes")
                .select("id")
                .eq("post_id", target_post_id)
                .eq("persona_id", persona_id)
                .limit(1)
                .execute()
            )
            if not existing.data:
                insert_result = (
                    sb.table("sns_likes")
                    .insert({"post_id": target_post_id, "persona_id": persona_id})
                    .execute()
                )
                result = {"like_id": insert_result.data[0]["id"]} if insert_result.data else {}
            else:
                result = {"already_liked": True}

    elif activity_type == "follow":
        target_persona_id = state.get("target_persona_id", "")
        if target_persona_id:
            # Check if already following
            existing = (
                sb.table("sns_follows")
                .select("id")
                .eq("follower_id", persona_id)
                .eq("following_id", target_persona_id)
                .limit(1)
                .execute()
            )
            if not existing.data:
                insert_result = (
                    sb.table("sns_follows")
                    .insert({"follower_id": persona_id, "following_id": target_persona_id})
                    .execute()
                )
                result = {"follow_id": insert_result.data[0]["id"]} if insert_result.data else {}
            else:
                result = {"already_following": True}

    return {"result": result}


async def log_activity(state: ActivityState) -> dict:
    """Insert a record into activity_logs table."""
    sb = get_supabase()

    log_row = {
        "persona_id": state["persona_id"],
        "activity_type": state.get("activity_type", "post"),
        "detail": {
            "content": state.get("content", ""),
            "target_post_id": state.get("target_post_id") or None,
            "target_persona_id": state.get("target_persona_id") or None,
            "image_url": state.get("image_url") or None,
            "result": state.get("result", {}),
        },
        "triggered_by": state.get("triggered_by", "manual"),
    }

    try:
        sb.table("activity_logs").insert(log_row).execute()
    except Exception:
        # Logging failure should not break the activity
        pass

    return {}


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

graph = StateGraph(ActivityState)

graph.add_node("collect_context", collect_context)
graph.add_node("decide_activity", decide_activity)
graph.add_node("generate_image", generate_image)
graph.add_node("execute_action", execute_action)
graph.add_node("log_activity", log_activity)

graph.add_edge(START, "collect_context")
graph.add_edge("collect_context", "decide_activity")
graph.add_conditional_edges(
    "decide_activity",
    check_image,
    {
        "generate_image": "generate_image",
        "execute_action": "execute_action",
    },
)
graph.add_edge("generate_image", "execute_action")
graph.add_edge("execute_action", "log_activity")
graph.add_edge("log_activity", END)

activity_graph = graph.compile()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def run_activity(
    persona_id: str,
    command: str,
    triggered_by: str,
    user_id: str,
) -> dict:
    """Run the activity graph and return the result."""
    initial_state: ActivityState = {
        "persona_id": persona_id,
        "command": command,
        "triggered_by": triggered_by,
        "user_id": user_id,
        "persona": {},
        "recent_posts": [],
        "recent_logs": [],
        "activity_type": "",
        "content": "",
        "target_post_id": "",
        "target_persona_id": "",
        "needs_image": False,
        "image_url": "",
        "result": {},
    }

    final_state = await activity_graph.ainvoke(initial_state)

    return {
        "activity_type": final_state.get("activity_type", ""),
        "content": final_state.get("content", ""),
        "target_post_id": final_state.get("target_post_id", ""),
        "target_persona_id": final_state.get("target_persona_id", ""),
        "image_url": final_state.get("image_url", ""),
        "result": final_state.get("result", {}),
    }


# ---------------------------------------------------------------------------
# Auto-interaction engine
# ---------------------------------------------------------------------------


async def auto_interact() -> None:
    """Run automatic inter-persona interactions.

    This function is called periodically by the scheduler. For each active AI
    persona it:
    1. Checks recent posts from followed personas and reacts (like/comment)
    2. Discovers new personas and auto-follows if interests align
    """
    sb = get_supabase()

    # Get all personas that have at least one active schedule (i.e. "active" AI personas)
    active_schedules = (
        sb.table("activity_schedules")
        .select("persona_id, user_id")
        .eq("is_active", True)
        .execute()
    )
    if not active_schedules.data:
        return

    # Deduplicate persona_id -> user_id mapping
    persona_map: dict[str, str] = {}
    for row in active_schedules.data:
        persona_map[row["persona_id"]] = row["user_id"]

    for persona_id, user_id in persona_map.items():
        try:
            await _auto_react_to_feed(persona_id, user_id)
            await _auto_discover_and_follow(persona_id, user_id)
        except Exception:
            logger.exception("Auto-interact failed for persona %s", persona_id)


async def _auto_react_to_feed(persona_id: str, user_id: str) -> None:
    """React to recent posts in the persona's feed using the activity graph."""
    sb = get_supabase()

    # Get posts from followed personas in the last 24 hours that this persona
    # hasn't already interacted with
    follows_result = (
        sb.table("sns_follows")
        .select("following_id")
        .eq("follower_id", persona_id)
        .execute()
    )
    following_ids = [f["following_id"] for f in follows_result.data]
    if not following_ids:
        return

    recent_posts = (
        sb.table("sns_posts")
        .select("id, persona_id, content, created_at")
        .in_("persona_id", following_ids)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    if not recent_posts.data:
        return

    # Check which posts we already interacted with (liked or commented)
    post_ids = [p["id"] for p in recent_posts.data]
    existing_likes = (
        sb.table("sns_likes")
        .select("post_id")
        .eq("persona_id", persona_id)
        .in_("post_id", post_ids)
        .execute()
    )
    liked_post_ids = {l["post_id"] for l in existing_likes.data}

    existing_comments = (
        sb.table("sns_comments")
        .select("post_id")
        .eq("persona_id", persona_id)
        .in_("post_id", post_ids)
        .execute()
    )
    commented_post_ids = {c["post_id"] for c in existing_comments.data}

    # Filter to posts we haven't interacted with yet
    unseen_posts = [
        p for p in recent_posts.data
        if p["id"] not in liked_post_ids and p["id"] not in commented_post_ids
    ]

    if not unseen_posts:
        return

    # Run activity graph to react to new feed content
    command = (
        "React to new posts in your feed. "
        "Like posts you enjoy, or comment if you have something meaningful to say. "
        "Be authentic to your personality."
    )

    try:
        await run_activity(
            persona_id=persona_id,
            command=command,
            triggered_by="auto",
            user_id=user_id,
        )
    except Exception:
        logger.exception("Auto-react failed for persona %s", persona_id)


async def _auto_discover_and_follow(persona_id: str, user_id: str) -> None:
    """Discover and follow new personas with similar interests."""
    sb = get_supabase()

    # Get current following list
    follows_result = (
        sb.table("sns_follows")
        .select("following_id")
        .eq("follower_id", persona_id)
        .execute()
    )
    following_ids = {f["following_id"] for f in follows_result.data}

    # Get this persona's info
    persona_result = (
        sb.table("personas")
        .select("id, personality, background")
        .eq("id", persona_id)
        .limit(1)
        .execute()
    )
    if not persona_result.data:
        return

    # Find personas not yet followed (exclude self and already-followed)
    exclude_ids = list(following_ids | {persona_id})
    candidates = (
        sb.table("personas")
        .select("id, name, personality, background")
        .not_.in_("id", exclude_ids)
        .limit(5)
        .execute()
    )
    if not candidates.data:
        return

    # Use the activity graph to decide whether to follow any of them
    candidate_descriptions = "\n".join(
        f"- {c['name']} (id:{c['id']}): {(c.get('personality') or '')[:80]}"
        for c in candidates.data
    )
    command = (
        f"Here are some personas you don't follow yet:\n{candidate_descriptions}\n\n"
        "If any of them seem interesting to you based on your personality, follow one."
    )

    try:
        await run_activity(
            persona_id=persona_id,
            command=command,
            triggered_by="auto",
            user_id=user_id,
        )
    except Exception:
        logger.exception("Auto-discover failed for persona %s", persona_id)
