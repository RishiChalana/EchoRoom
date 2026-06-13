from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException

from app.core.config import settings


async def get_current_user_optional(
    session_token: Optional[str] = Cookie(None, alias="next-auth.session-token"),
) -> Optional[dict]:
    """
    Validates a NextAuth.js session token (JWT signed with NEXTAUTH_SECRET).
    Returns the decoded payload (contains name, email, sub/picture from Google)
    or None if not present or invalid.
    Use get_current_user for protected endpoints.
    """
    if not session_token or not settings.NEXTAUTH_SECRET:
        return None
    try:
        payload = jwt.decode(
            session_token,
            settings.NEXTAUTH_SECRET,
            algorithms=["HS256"],
        )
        return payload
    except jwt.PyJWTError:
        return None


async def get_current_user(
    user: Optional[dict] = Depends(get_current_user_optional),
) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
