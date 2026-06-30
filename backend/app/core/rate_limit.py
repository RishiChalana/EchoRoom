from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address


def get_rate_limit_key(request):
    """
    Rate limit by the last 32 chars of the JWT token when authenticated,
    otherwise by IP. This avoids decoding the token on every request
    while still isolating limits per user session rather than per IP
    (important for shared networks like offices or carrier-grade NAT).
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[-32:]
    return get_remote_address(request)


limiter = Limiter(key_func=get_rate_limit_key)
