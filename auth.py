import os
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24  # 24 heures en minutes

# Compte admin hardcode (comme dans votre code Streamlit)
ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD_HASH = bcrypt.hashpw("admin156".encode(), bcrypt.gensalt())

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())


def verify_password(plain: str, hashed: bytes) -> bool:
    if isinstance(hashed, str):
        hashed = hashed.encode()
    return bcrypt.checkpw(plain.encode(), hashed)


def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expire"
        )


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    return decode_token(credentials.credentials)


def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acces administrateur requis")
    return user


def require_user(user=Depends(get_current_user)):
    if user.get("role") not in ("user", "admin"):
        raise HTTPException(status_code=403, detail="Acces refuse")
    return user
