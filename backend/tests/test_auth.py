"""Auth endpoint tests — register, login, issue-token.

Each test uses a distinct email to avoid cross-test conflicts since data
persists within a single pytest session (rollback-per-test is not used here).
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

INTERNAL_SECRET = "test-secret-for-pytest-only"
REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ISSUE_TOKEN_URL = "/api/v1/auth/internal/issue-token"


# ── Register ───────────────────────────────────────────────────────────────────


async def test_register_creates_user(client: AsyncClient) -> None:
    res = await client.post(
        REGISTER_URL,
        json={"email": "register1@test.com", "password": "password123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "register1@test.com"
    assert "id" in data
    assert "hashed_password" not in data


async def test_register_with_name(client: AsyncClient) -> None:
    res = await client.post(
        REGISTER_URL,
        json={"email": "nameduser@test.com", "password": "password123", "name": "Alice"},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Alice"


async def test_register_duplicate_email_fails(client: AsyncClient) -> None:
    payload = {"email": "dupe@test.com", "password": "password123"}
    first = await client.post(REGISTER_URL, json=payload)
    assert first.status_code == 200
    second = await client.post(REGISTER_URL, json=payload)
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"]


async def test_register_short_password_fails(client: AsyncClient) -> None:
    res = await client.post(
        REGISTER_URL,
        json={"email": "shortpw@test.com", "password": "abc"},
    )
    assert res.status_code == 400
    assert "8 characters" in res.json()["detail"]


async def test_register_invalid_email_fails(client: AsyncClient) -> None:
    res = await client.post(
        REGISTER_URL,
        json={"email": "not-an-email", "password": "password123"},
    )
    assert res.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────────


async def test_login_correct_credentials_succeeds(client: AsyncClient) -> None:
    await client.post(
        REGISTER_URL,
        json={"email": "loginok@test.com", "password": "correct_password"},
    )
    res = await client.post(
        LOGIN_URL,
        json={"email": "loginok@test.com", "password": "correct_password"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "loginok@test.com"
    assert "id" in data


async def test_login_wrong_password_fails(client: AsyncClient) -> None:
    await client.post(
        REGISTER_URL,
        json={"email": "loginwrong@test.com", "password": "correct_password"},
    )
    res = await client.post(
        LOGIN_URL,
        json={"email": "loginwrong@test.com", "password": "wrong_password"},
    )
    assert res.status_code == 401
    assert "Invalid" in res.json()["detail"]


async def test_login_nonexistent_user_fails(client: AsyncClient) -> None:
    res = await client.post(
        LOGIN_URL,
        json={"email": "nobody@test.com", "password": "any_password"},
    )
    assert res.status_code == 401


# ── Issue-token ────────────────────────────────────────────────────────────────


async def test_issue_token_requires_internal_secret(client: AsyncClient) -> None:
    res = await client.post(
        ISSUE_TOKEN_URL,
        json={"email": "anyone@test.com"},
        headers={"X-Internal-Secret": "wrong-secret"},
    )
    assert res.status_code == 403


async def test_issue_token_with_correct_secret_returns_jwt(client: AsyncClient) -> None:
    res = await client.post(
        ISSUE_TOKEN_URL,
        json={"email": "tokentest@test.com"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 20


async def test_issued_token_is_accepted_by_sessions_endpoint(client: AsyncClient) -> None:
    token_res = await client.post(
        ISSUE_TOKEN_URL,
        json={"email": "tokenuse@test.com"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert token_res.status_code == 200
    token = token_res.json()["access_token"]

    session_res = await client.post(
        "/api/v1/sessions",
        json={"audience_profile": "general"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session_res.status_code == 201
    assert "id" in session_res.json()

    list_res = await client.get(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    ids = [s["id"] for s in list_res.json()["sessions"]]
    assert session_res.json()["id"] in ids
