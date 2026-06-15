from __future__ import annotations

from typing import Optional

import structlog
from fastapi import HTTPException
from starlette.requests import HTTPConnection

log = structlog.get_logger(__name__)


async def get_current_user_optional(request: HTTPConnection) -> Optional[dict]:
    """
    Reads user identity from the X-User-Email header.

    Accepts HTTPConnection so it works for both HTTP endpoints (Request) and
    WebSocket endpoints (WebSocket) — both are subclasses of HTTPConnection and
    both expose .headers. FastAPI injects the concrete connection type at call
    time so no caller changes are needed.

    Note: the browser WebSocket API cannot set custom headers during the
    handshake, so WebSocket callers always receive None. The session UUID is
    the security boundary for live sessions; ownership checks are intentionally
    skipped when current_user is None.
    """
    email = request.headers.get("X-User-Email", "").strip()
    if not email or "@" not in email:
        return None
    log.info("User identified", email=email)
    return {"email": email}


async def get_current_user(request: HTTPConnection) -> dict:
    user = await get_current_user_optional(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
