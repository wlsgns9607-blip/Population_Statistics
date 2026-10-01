"""원본 CSV/XLS -> SQLite(seoul.db) + seoul.sql 덤프.  pip install pandas xlrd"""
import sqlite3, pandas as pd
U = "/mnt/user-data/uploads/"          # 로컬 실행 시 경로 변경
SCHEMA = """
DROP VIEW IF EXISTS v_district_stats; DROP TABLE IF EXISTS cctv_install; DROP TABLE IF EXISTS population; DROP TABLE IF EXISTS district;
CREATE TABLE district(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE cctv_install(district_id INT REFERENCES district(id), period TEXT, count INT,
  PRIMARY KEY(district_id, period));          -- period: 'total'(원본 소계) | 'pre2013' | '2014' | '2015' | '2016'
CREATE TABLE population(district_id INT REFERENCES district(id), ref_period TEXT,
  kind TEXT CHECK(kind IN('resident','living')),   -- living = 생활인구(추후 API 적재)
  households INT, total INT, korean INT, foreign_n INT, senior INT,
  PRIMARY KEY(district_id, ref_period, kind));
CREATE VIEW v_district_stats AS
  SELECT d.name, (SELECT count FROM cctv_install c WHERE c.district_id=d.id AND c.period='total') AS cctv,
         p.total AS pop, p.foreign_n, p.senior,
         ROUND(100.0*p.foreign_n/p.total,2) AS foreign_ratio, ROUND(100.0*p.senior/p.total,2) AS senior_ratio
  FROM district d JOIN population p ON p.district_id=d.id AND p.kind='resident';
"""
c = pd.read_csv(U + "01__CCTV_in_Seoul.csv").rename(columns={"기관명": "name"})
p = pd.read_excel(U + "01__population_in_Seoul.xls", header=None, skiprows=3, usecols=[0, 1, 2, 3, 6, 9, 13])
p.columns = ["period", "name", "hh", "total", "korean", "foreign_n", "senior"]
p = p[p["name"] != "합계"].dropna(subset=["name"])
con = sqlite3.connect("seoul.db"); con.executescript(SCHEMA)
ids = {n: i + 1 for i, n in enumerate(c["name"])}
con.executemany("INSERT INTO district VALUES(?,?)", [(i, n) for n, i in ids.items()])
per = {"소계": "total", "2013년도 이전": "pre2013", "2014년": "2014", "2015년": "2015", "2016년": "2016"}
con.executemany("INSERT INTO cctv_install VALUES(?,?,?)",
  [(ids[r["name"]], k, int(r[col])) for _, r in c.iterrows() for col, k in per.items()])
con.executemany("INSERT INTO population VALUES(?,?,?,?,?,?,?,?)",
  [(ids[r["name"]], str(r["period"]), "resident", int(r.hh), int(r.total), int(r.korean), int(r.foreign_n), int(r.senior))
   for _, r in p.iterrows() if r["name"] in ids])
con.commit()
open("seoul.sql", "w", encoding="utf-8").write("\n".join(con.iterdump()))
for q in ["SELECT COUNT(*) FROM district","SELECT COUNT(*) FROM cctv_install","SELECT COUNT(*) FROM population",
          "SELECT name,cctv,pop,foreign_ratio,senior_ratio FROM v_district_stats ORDER BY 1.0*cctv/pop DESC LIMIT 3"]:
    print(con.execute(q).fetchall())
