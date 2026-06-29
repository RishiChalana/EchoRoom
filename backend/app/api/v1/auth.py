from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import create_access_token
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    id: str
    email: str
    name: str | None


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )


@router.post("/register", response_model=AuthResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    _validate_password_strength(body.password)

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(id=user.id, email=user.email, name=user.name)


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(id=user.id, email=user.email, name=user.name)


class IssueTokenRequest(BaseModel):
    email: EmailStr


class IssueTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/internal/issue-token", response_model=IssueTokenResponse)
async def issue_token(body: IssueTokenRequest, request: Request) -> IssueTokenResponse:
    """Mints a backend-signed JWT. Only callable server-side (from NextAuth's
    jwt callback) via the shared X-Internal-Secret header — browsers never
    possess this secret."""
    provided_secret = request.headers.get("X-Internal-Secret", "")
    if not settings.NEXTAUTH_SECRET or provided_secret != settings.NEXTAUTH_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal secret")

    token = create_access_token(body.email)
    return IssueTokenResponse(access_token=token)
