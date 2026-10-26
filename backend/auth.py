import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlmodel import Session, select

from database import get_session
from models import User

ALGORITHM = "HS256"
COOKIE_NAME = "testagent_session"
ACCESS_TOKEN_EXPIRE_DAYS = 14


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        # Dev fallback so local boot works before secrets are configured
        return "dev-insecure-jwt-secret-change-me"
    return secret


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (JWTError, ValueError, TypeError):
        return None


def get_token_from_request(request: Request) -> Optional[str]:
    cookie = request.cookies.get(COOKIE_NAME)
    if cookie:
        return cookie
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
) -> User:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_optional_user(
    request: Request,
    session: Session = Depends(get_session),
) -> Optional[User]:
    token = get_token_from_request(request)
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        return None
    return session.get(User, user_id)


def cookie_settings() -> dict:
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    return {
        "key": COOKIE_NAME,
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "max_age": ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        "path": "/",
    }
