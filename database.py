import sqlite3
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "users.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            nom            TEXT,
            prenom         TEXT,
            email          TEXT UNIQUE,
            password       BLOB,
            etablissement  TEXT,
            examen         TEXT,
            paye_numero    TEXT,
            inscrit        INTEGER DEFAULT 0,
            role           TEXT DEFAULT 'visitor'
        )
    """)
    conn.commit()
    conn.close()

    os.makedirs(os.path.join(BASE_DIR, "uploads", "sujets"), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, "uploads", "cours"), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)

    for name in ["sujets.json", "cours.json", "qcm.json"]:
        f = os.path.join(BASE_DIR, "data", name)
        if not os.path.exists(f):
            with open(f, "w") as fp:
                fp.write("[]")
