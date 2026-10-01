import sqlite3
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Seoul Population & CCTV")

QUERY = """
SELECT d.id,
       d.name,
       p.total      AS population,
       p.korean     AS korean,
       p.foreign_n  AS foreign_pop,
       p.senior     AS senior,
       p.households AS households,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = 'total') AS cctv,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = 'pre2013') AS cctv_pre2013,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = '2014') AS cctv_2014,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = '2015') AS cctv_2015,
       (SELECT count FROM cctv_install c WHERE c.district_id = d.id AND c.period = '2016') AS cctv_2016
FROM district d
JOIN population p ON p.district_id = d.id AND p.kind = 'resident'
"""

@app.get("/api/districts")
def districts():
    con = sqlite3.connect("seoul.db")
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute(QUERY)]
    con.close()
    
    for r in rows:
        pre = r.get('cctv_pre2013') or 0
        recent_sum = (r.get('cctv_2014') or 0) + (r.get('cctv_2015') or 0) + (r.get('cctv_2016') or 0)
        r['cctv_growth_rate'] = round((recent_sum / pre * 100), 2) if pre > 0 else 0.0

    return {"count": len(rows), "districts": rows}

@app.get("/")
def index():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
