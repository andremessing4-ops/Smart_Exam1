import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routeurs import auth_routeur, admin_router, content_routeur

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routeur.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")
app.include_router(content_routeur.router, prefix="/api")

app.mount(
    "/uploads",
    StaticFiles(directory=os.path.join(BASE_DIR, "uploads")),
    name="uploads",
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/webapp.js")
def webapp_js():
    path = os.path.join(BASE_DIR, "webapp.js")
    if os.path.isfile(path):
        return FileResponse(path, media_type="application/javascript")
    from fastapi import HTTPException

    raise HTTPException(status_code=404)


@app.get("/")
def home():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "Backend OK — placez index.html à côté de main.py."}
