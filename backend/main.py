from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.persona import router as persona_router
from api.chat import router as chat_router

load_dotenv()

app = FastAPI(title="Alter Ego API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(persona_router)
app.include_router(chat_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
