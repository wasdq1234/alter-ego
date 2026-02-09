def test_persona_requires_auth(client):
    """인증 없이 요청하면 401."""
    resp = client.get("/api/persona")
    assert resp.status_code == 401


def test_invalid_token_rejected(client):
    """잘못된 토큰은 401."""
    resp = client.get(
        "/api/persona",
        headers={"Authorization": "Bearer invalid_token_here"},
    )
    assert resp.status_code == 401


def test_valid_token_accepted(client, auth_headers):
    """유효한 토큰으로 요청 성공."""
    resp = client.get("/api/persona", headers=auth_headers)
    assert resp.status_code == 200
