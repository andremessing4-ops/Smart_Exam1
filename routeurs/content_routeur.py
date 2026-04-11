import json, os, uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from auth import require_admin, require_user

router = APIRouter(prefix="/api/content", tags=["Content"])

DATA_FILES = {
 "sujets": os.path.join(BASE_DIR, "data", "sujets.json"),
    "cours":  os.path.join(BASE_DIR, "data", "cours.json"),
    "qcm":    os.path.join(BASE_DIR, "data", "qcm.json"),
}

def load_json(key: str):
    path = DATA_FILES[key]
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return []


def save_json(key: str, data: list):
    with open(DATA_FILES[key], "w") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def save_upload(folder: str, file: UploadFile) -> str:
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    name = f"{uuid.uuid4()}.{ext}"
    abs_dir = os.path.join(BASE_DIR, *folder.replace("\\", "/").split("/"))
    os.makedirs(abs_dir, exist_ok=True)
    path = os.path.join(abs_dir, name)
    with open(path, "wb") as f:
        f.write(file.file.read())
    sub = folder.replace("\\", "/").rstrip("/").split("/")[-1]
    return f"/uploads/{sub}/{name}" 


# ─── SUJETS ────────────────────────────────────────────────────────────────

@router.get("/sujets")
def list_sujets(niveau: str = None, filiere: str = None, user=Depends(require_user)):
    data = load_json("sujets")
    if niveau:
        data = [s for s in data if s.get("niveau") == niveau]
    if filiere:
        data = [s for s in data if s.get("filiere") == filiere]
    return data


@router.post("/sujets")
async def add_sujet(
    titre:   str        = Form(...),
    niveau:  str        = Form(...),
    filiere: str        = Form(...),
    fichier: UploadFile = File(...),
    user=Depends(require_admin)
):
    chemin = save_upload("uploads/sujets", fichier)
    data   = load_json("sujets")
    data.append({"titre": titre, "fichier": chemin, "niveau": niveau, "filiere": filiere})
    save_json("sujets", data)
    return {"message": "Sujet ajoute", "chemin": chemin}


@router.delete("/sujets/{index}")
def delete_sujet(index: int, user=Depends(require_admin)):
    data = load_json("sujets")
    if index < 0 or index >= len(data):
        raise HTTPException(status_code=404, detail="Sujet introuvable")
    data.pop(index)
    save_json("sujets", data)
    return {"message": "Sujet supprime"}


# ─── COURS ─────────────────────────────────────────────────────────────────

@router.get("/cours")
def list_cours(niveau: str = None, filiere: str = None, user=Depends(require_user)):
    data = load_json("cours")
    if niveau:
        data = [c for c in data if c.get("niveau") == niveau]
    if filiere:
        data = [c for c in data if c.get("filiere") == filiere]
    return data


@router.post("/cours")
async def add_cours(
    titre:   str        = Form(...),
    niveau:  str        = Form(...),
    filiere: str        = Form(...),
    video:   UploadFile = File(...),
    user=Depends(require_admin)
):
    chemin = save_upload("uploads/cours", video)
    data   = load_json("cours")
    data.append({"titre": titre, "video": chemin, "niveau": niveau, "filiere": filiere})
    save_json("cours", data)
    return {"message": "Cours ajoute", "chemin": chemin}


@router.delete("/cours/{index}")
def delete_cours(index: int, user=Depends(require_admin)):
    data = load_json("cours")
    if index < 0 or index >= len(data):
        raise HTTPException(status_code=404, detail="Cours introuvable")
    data.pop(index)
    save_json("cours", data)
    return {"message": "Cours supprime"}


# ─── QCM ───────────────────────────────────────────────────────────────────

@router.get("/qcm")
def list_qcm(niveau: str = None, filiere: str = None, user=Depends(require_user)):
    data = load_json("qcm")
    if niveau:
        data = [q for q in data if q.get("niveau") == niveau]
    if filiere:
        data = [q for q in data if q.get("filiere") == filiere]
    return data


@router.post("/qcm")
def add_qcm(
    question: str = Form(...),
    options:  str = Form(...),   # separees par ";"
    answer:   str = Form(...),
    niveau:   str = Form(...),
    filiere:  str = Form(...),
    user=Depends(require_admin)
):
    data = load_json("qcm")
    data.append({
        "question": question,
        "options":  [o.strip() for o in options.split(";")],
        "answer":   answer.strip(),
        "niveau":   niveau,
        "filiere":  filiere
    })
    save_json("qcm", data)
    return {"message": "QCM ajoute"}


@router.delete("/qcm/{index}")
def delete_qcm(index: int, user=Depends(require_admin)):
    data = load_json("qcm")
    if index < 0 or index >= len(data):
        raise HTTPException(status_code=404, detail="QCM introuvable")
    data.pop(index)
    save_json("qcm", data)
    return {"message": "QCM supprime"}
