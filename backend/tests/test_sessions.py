"""Session endpoint tests — creation, ownership isolation, deletion.

Regression test included: the old X-User-Email trust header must have no effect
now that auth is JWT-based.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

INTERNAL_SECRET = "test-secret-for-pytest-only"
ISSUE_TOKEN_URL = "/api/v1/auth/internal/issue-token"
SESSIONS_URL = "/api/v1/sessions"


async def _auth_headers(client: AsyncClient, email: str) -> dict[str, str]:
    """Mint a backend JWT for *email* and return Authorization headers."""
    res = await client.post(
        ISSUE_TOKEN_URL,
        json={"email": email},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert res.status_code == 200, f"issue-token failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Creation ───────────────────────────────────────────────────────────────────


async def test_create_session_returns_201(client: AsyncClient) -> None:
    headers = await _auth_headers(client, "create1@test.com")
    res = await client.post(
        SESSIONS_URL,
        json={"name": "My session", "audience_profile": "technical"},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert "id" in data
    assert data["status"] == "active"
    assert data["audience_profile"] == "technical"


async def test_create_session_name_is_optional(client: AsyncClient) -> None:
    headers = await _auth_headers(client, "create2@test.com")
    res = await client.post(
        SESSIONS_URL,
        json={"audience_profile": "general"},
        headers=headers,
    )
    assert res.status_code == 201


async def test_create_session_stamps_user_email(client: AsyncClient) -> None:
    """Sessions created with a valid token must be visible in that user's list."""
    email = "stampuser@test.com"
    headers = await _auth_headers(client, email)
    created = await client.post(SESSIONS_URL, json={}, headers=headers)
    assert created.status_code == 201
    session_id = created.json()["id"]

    listed = await client.get(SESSIONS_URL, headers=headers)
    assert listed.status_code == 200
    ids = [s["id"] for s in listed.json()["sessions"]]
    assert session_id in ids


# ── Ownership isolation ────────────────────────────────────────────────────────


async def test_user_only_sees_own_sessions(client: AsyncClient) -> None:
    headers_a = await _auth_headers(client, "isolate_a@test.com")
    headers_b = await _auth_headers(client, "isolate_b@test.com")

    session_a = await client.post(SESSIONS_URL, json={"name": "A's session"}, headers=headers_a)
    session_b = await client.post(SESSIONS_URL, json={"name": "B's session"}, headers=headers_b)
    assert session_a.status_code == 201
    assert session_b.status_code == 201
    id_a = session_a.json()["id"]
    id_b = session_b.json()["id"]

    ids_a = [s["id"] for s in (await client.get(SESSIONS_URL, headers=headers_a)).json()["sessions"]]
    ids_b = [s["id"] for s in (await client.get(SESSIONS_URL, headers=headers_b)).json()["sessions"]]

    assert id_a in ids_a
    assert id_b not in ids_a
    assert id_b in ids_b
    assert id_a not in ids_b


async def test_unauthenticated_request_sees_no_sessions(client: AsyncClient) -> None:
    # Unauthenticated: no 401 — the endpoint returns an empty list.
    res = await client.get(SESSIONS_URL)
    assert res.status_code == 200
    assert res.json()["sessions"] == []


async def test_forged_x_user_email_header_has_no_effect(client: AsyncClient) -> None:
    """Sending X-User-Email without a Bearer token must not create an owned session.

    Regression guard: the old X-User-Email trust header was removed. The new
    auth layer only reads the signed JWT in Authorization: Bearer.
    """
    victim_email = "victim@test.com"
    victim_headers = await _auth_headers(client, victim_email)

    # Create a session with a forged identity header but NO real JWT.
    forged = await client.post(
        SESSIONS_URL,
        json={"name": "Forged session"},
        headers={"X-User-Email": victim_email},
    )
    assert forged.status_code == 201
    forged_id = forged.json()["id"]

    # The victim user, authenticated with a real token, must NOT see this session.
    victim_list = await client.get(SESSIONS_URL, headers=victim_headers)
    ids = [s["id"] for s in victim_list.json()["sessions"]]
    assert forged_id not in ids


# ── Deletion ───────────────────────────────────────────────────────────────────


async def test_delete_own_session_returns_204(client: AsyncClient) -> None:
    headers = await _auth_headers(client, "deleter@test.com")
    created = await client.post(SESSIONS_URL, json={}, headers=headers)
    session_id = created.json()["id"]

    del_res = await client.delete(f"{SESSIONS_URL}/{session_id}", headers=headers)
    assert del_res.status_code == 204

    get_res = await client.get(f"{SESSIONS_URL}/{session_id}", headers=headers)
    assert get_res.status_code == 404


async def test_delete_nonexistent_session_returns_404(client: AsyncClient) -> None:
    headers = await _auth_headers(client, "deleter2@test.com")
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = await client.delete(f"{SESSIONS_URL}/{fake_id}", headers=headers)
    assert res.status_code == 404
