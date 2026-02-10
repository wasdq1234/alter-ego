"""APScheduler integration for automated persona activity execution."""

import asyncio
import logging
import re

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from core.activity import auto_interact, run_activity
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def _job_id(schedule_id: str) -> str:
    """Generate a consistent job ID from a schedule ID."""
    return f"activity_{schedule_id}"


def _parse_interval(value: str) -> dict:
    """Parse an interval string like '3h', '30m', '1d' into trigger kwargs."""
    match = re.match(r"^(\d+)\s*([smhd])$", value.strip().lower())
    if not match:
        raise ValueError(f"Invalid interval format: {value}")
    amount = int(match.group(1))
    unit = match.group(2)
    mapping = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days"}
    return {mapping[unit]: amount}


async def _execute_schedule(
    schedule_id: str,
    persona_id: str,
    user_id: str,
    activity_type: str,
    activity_prompt: str | None,
) -> None:
    """Execute a scheduled activity by running the LangGraph activity graph."""
    command = activity_prompt or f"Perform a {activity_type} activity as scheduled."
    try:
        result = await run_activity(
            persona_id=persona_id,
            command=command,
            triggered_by="schedule",
            user_id=user_id,
        )
        logger.info(
            "Schedule %s executed: %s -> %s",
            schedule_id,
            activity_type,
            result.get("activity_type"),
        )
    except Exception:
        logger.exception("Schedule %s execution failed", schedule_id)


def add_schedule_job(schedule: dict) -> None:
    """Add or replace a job for the given schedule dict."""
    schedule_id = schedule["id"]
    job_id = _job_id(schedule_id)

    # Remove existing job if present
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    schedule_type = schedule["schedule_type"]
    schedule_value = schedule["schedule_value"]

    if schedule_type == "cron":
        trigger = CronTrigger.from_crontab(schedule_value)
    elif schedule_type == "interval":
        interval_kwargs = _parse_interval(schedule_value)
        trigger = IntervalTrigger(**interval_kwargs)
    else:
        logger.warning("Unknown schedule type: %s", schedule_type)
        return

    scheduler.add_job(
        _execute_schedule,
        trigger=trigger,
        id=job_id,
        kwargs={
            "schedule_id": schedule_id,
            "persona_id": schedule["persona_id"],
            "user_id": schedule["user_id"],
            "activity_type": schedule["activity_type"],
            "activity_prompt": schedule.get("activity_prompt"),
        },
        replace_existing=True,
    )
    logger.info("Job %s added for schedule %s", job_id, schedule_id)


def remove_schedule_job(schedule_id: str) -> None:
    """Remove a job for the given schedule ID."""
    job_id = _job_id(schedule_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info("Job %s removed", job_id)


def load_all_schedules() -> None:
    """Load all active schedules from the DB and register jobs."""
    sb = get_supabase()
    result = (
        sb.table("activity_schedules")
        .select("*")
        .eq("is_active", True)
        .execute()
    )

    for schedule in result.data:
        try:
            add_schedule_job(schedule)
        except Exception:
            logger.exception("Failed to load schedule %s", schedule["id"])

    logger.info("Loaded %d active schedules", len(result.data))


def _register_auto_interact_job() -> None:
    """Register the periodic auto-interaction job (runs every hour)."""
    scheduler.add_job(
        auto_interact,
        trigger=IntervalTrigger(hours=1),
        id="auto_interact",
        replace_existing=True,
    )
    logger.info("Auto-interact job registered (every 1 hour)")


def start_scheduler() -> None:
    """Start the scheduler and load all active schedules."""
    load_all_schedules()
    _register_auto_interact_job()
    scheduler.start()
    logger.info("Activity scheduler started")


def stop_scheduler() -> None:
    """Shut down the scheduler gracefully."""
    scheduler.shutdown(wait=False)
    logger.info("Activity scheduler stopped")
