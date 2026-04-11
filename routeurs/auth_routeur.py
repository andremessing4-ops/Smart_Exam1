from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn
from auth import (
    hash_password, verify_password, create_token,
    ADMIN_EMAIL, ADMIN_PASSWORD_HASH
)

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterBody(BaseModel):
    nom:           str
    prenom:        str
    email:         str
    password:      str
    etablissement: str
    examen:        str
    paye_numero:   str


class LoginBody(BaseModel):
    email:    str
    password: str


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


@router.post("/register")
def register(body: RegisterBody):
    email_norm = _normalize_email(body.email)
    if not email_norm or "@" not in email_norm:
        raise HTTPException(status_code=400, detail="Adresse e-mail invalide")

    if email_norm == _normalize_email(ADMIN_EMAIL):
        raise HTTPException(status_code=409, detail="Cet e-mail ne peut pas etre utilise")

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email_norm,))
    if c.fetchone():
        conn.close()
        raise HTTPException(
            status_code=409,
            detail="Un compte existe deja avec cette adresse e-mail",
        )

    try:
        hashed = hash_password(body.password)
        c.execute("""
            INSERT INTO users
                (nom, prenom, email, password, etablissement, examen, paye_numero, role)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            body.nom, body.prenom, email_norm,
            hashed, body.etablissement, body.examen,
            body.paye_numero, "visitor"
        ))
        conn.commit()
        return {"message": "Inscription reussie. En attente de validation."}
    except Exception as e:
        conn.rollback()
        if "UNIQUE constraint" in str(e):
            raise HTTPException(
                status_code=409,
                detail="Un compte existe deja avec cette adresse e-mail",
            )
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/login")
def login(body: LoginBody):
    email_norm = _normalize_email(body.email)

    # Verif compte admin
    if email_norm == _normalize_email(ADMIN_EMAIL):
        if verify_password(body.password, ADMIN_PASSWORD_HASH):
            token = create_token({"email": ADMIN_EMAIL, "role": "admin"})
            return {"token": token, "role": "admin"}
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    # Verif utilisateur normal (e-mail insensible a la casse)
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "SELECT email, password, inscrit, role FROM users WHERE lower(email) = ?",
        (email_norm,),
    )
    row = c.fetchone()
    conn.close()

    if not row or not verify_password(body.password, row["password"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    role = "user" if row["inscrit"] else "visitor"
    token = create_token({"email": row["email"], "role": role})
    return {"token": token, "role": role}
