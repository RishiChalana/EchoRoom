from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])
log = structlog.get_logger(__name__)


class UpdateNameRequest(BaseModel):
    name: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]


@router.patch("/me", response_model=UserResponse)
@limiter.limit("10/minute")
async def update_me(
    request: Request,
    body: UpdateNameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> UserResponse:
    result = await db.execute(select(User).where(User.email == current_user["email"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = body.name.strip() or None
    await db.flush()
    await db.refresh(user)

    log.info("User name updated", email=user.email)
    return UserResponse(id=user.id, email=user.email, name=user.name)
