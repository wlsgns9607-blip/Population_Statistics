"""실행: pip install fastapi uvicorn  →  uvicorn app:app --reload  →  http://localhost:8000"""
import sqlite3
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Seoul Population & CCTV")

QUERY = """
SELECT d.name,
       p.total      AS population,
       p.korean     AS korean,
       p.foreign_n  AS foreign_pop,
       p.senior     AS senior,
       p.households AS households,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = 'total') AS cctv
FROM district d
JOIN population p ON p.district_id = d.id AND p.kind = 'resident'
"""

@app.get("/api/districts")
def districts():
    con = sqlite3.connect("seoul.db")
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute(QUERY)]
    con.close()
    return {"count": len(rows), "districts": rows}

@app.get("/")
def index():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
