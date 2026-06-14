from __future__ import annotations

from typing import Optional

import jwt
import structlog
from fastapi import Cookie, Depends, HTTPException

from app.core.config import settings

log = structlog.get_logger(__name__)


async def get_current_user_optional(
    # HTTP (development): next-auth.session-token
    session_token: Optional[str] = Cookie(None, alias="next-auth.session-token"),
    # HTTPS (production): NextAuth prefixes cookies with __Secure-
    secure_session_token: Optional[str] = Cookie(
        None, alias="__Secure-next-auth.session-token"
    ),
) -> Optional[dict]:
    """
    Validates a NextAuth.js HS256 session token signed with NEXTAUTH_SECRET.
    Accepts both HTTP (dev) and HTTPS (prod) cookie names.
    Returns the decoded payload (contains name, email, sub, picture) or None.
    """
    token = session_token or secure_session_token
    if not token or not settings.NEXTAUTH_SECRET:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.NEXTAUTH_SECRET,
            algorithms=["HS256"],
        )
        log.debug("Auth token decoded", email=payload.get("email"))
        return payload
    except jwt.PyJWTError as exc:
        log.debug("Auth token decode failed", error=str(exc))
        return None


async def get_current_user(
    user: Optional[dict] = Depends(get_current_user_optional),
) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
