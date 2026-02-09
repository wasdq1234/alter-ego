import os
import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
import requests

load_dotenv()

from main import app


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_token() -> str:
    """Supabase 테스트 유저 로그인 후 JWT 토큰 반환."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    email = "test@alter-ego.dev"
    password = "test123456"

    resp = requests.post(
        f"{url}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": key, "Content-Type": "application/json"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """인증 헤더."""
    return {"Authorization": f"Bearer {auth_token}"}
