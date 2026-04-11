from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_conn
from auth import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/accounts")
def list_all_accounts(user=Depends(require_admin)):
    """Tous les comptes enregistrés (sans mot de passe)."""
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, nom, prenom, email, etablissement, examen, paye_numero, inscrit, role
        FROM users
        ORDER BY id ASC
        """
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


@router.get("/pending")
def get_pending(user=Depends(require_admin)):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT nom, prenom, email, paye_numero FROM users WHERE inscrit=0 AND role='visitor'")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


@router.post("/validate/{email}")
def validate_user(email: str, user=Depends(require_admin)):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE users SET inscrit=1, role='user' WHERE email=?", (email,))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    conn.commit()
    conn.close()
    return {"message": f"{email} valide avec succes"}


@router.get("/visitors")
def get_visitors(user=Depends(require_admin)):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT nom, prenom, email FROM users WHERE role='visitor'")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


@router.delete("/visitors/{email}")
def delete_visitor(email: str, user=Depends(require_admin)):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE email=? AND role='visitor'", (email,))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Visiteur introuvable")
    conn.commit()
    conn.close()
    return {"message": f"{email} supprime"}
