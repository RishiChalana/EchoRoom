from __future__ import annotations

from typing import Optional

import structlog
from fastapi import HTTPException, Request

log = structlog.get_logger(__name__)


async def get_current_user_optional(request: Request) -> Optional[dict]:
    """
    Reads user identity from the X-User-Email request header.
    The header is set by the frontend (api.ts authHeaders) after NextAuth
    authenticates the user via getSession(). Protected by CORS — only
    requests from the allowed origin can set this header.
    """
    email = request.headers.get("X-User-Email", "").strip()
    if not email or "@" not in email:
        return None
    log.info("User identified", email=email)
    return {"email": email}


async def get_current_user(request: Request) -> dict:
    user = await get_current_user_optional(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
