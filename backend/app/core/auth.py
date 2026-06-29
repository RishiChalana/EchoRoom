from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt as pyjwt
from fastapi import HTTPException
from starlette.requests import HTTPConnection

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24


def create_access_token(email: str) -> str:
    """Mints a backend-signed JWT. Verified only by this backend — no
    cross-system format concerns since we own both sign and verify."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return pyjwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=ALGORITHM)


async def get_current_user_optional(request: HTTPConnection) -> Optional[dict]:
    """Verifies a Bearer JWT issued by /auth/internal/issue-token.
    Returns None (not an error) when the token is absent, malformed, or expired.
    HTTPConnection is used (not Request) so this dependency works for both
    HTTP endpoints and the WebSocket stream endpoint."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[len("Bearer "):].strip()
    if not token or not settings.NEXTAUTH_SECRET:
        return None

    try:
        payload = pyjwt.decode(
            token,
            settings.NEXTAUTH_SECRET,
            algorithms=[ALGORITHM],
        )
    except pyjwt.ExpiredSignatureError:
        logger.info("auth: token expired")
        return None
    except pyjwt.PyJWTError as exc:
        logger.warning("auth: token verification failed: %s", exc)
        return None

    email = payload.get("email")
    if not email:
        return None
    return {"email": email}


async def get_current_user(request: HTTPConnection) -> dict:
    user = await get_current_user_optional(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
