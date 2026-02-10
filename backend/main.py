import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.persona import router as persona_router
from api.chat import router as chat_router
from api.image import router as image_router
from api.sns import router as sns_router
from api.follow import router as follow_router
from api.lora import router as lora_router
from api.schedule import router as schedule_router
from api.activity import router as activity_router
from core.scheduler import start_scheduler, stop_scheduler

load_dotenv()

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Alter Ego API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(persona_router)
app.include_router(chat_router)
app.include_router(image_router)
app.include_router(sns_router)
app.include_router(follow_router)
app.include_router(lora_router)
app.include_router(schedule_router)
app.include_router(activity_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
