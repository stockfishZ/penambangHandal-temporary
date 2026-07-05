# geonirisk — NiTERRA

**Exploration targeting platform for nickel laterite deposits.**
Entry for ANTAM Hackathon 2026 — Theme: Eksplorasi.

## What it is

NiTERRA takes magnetometer, geochemistry, and study-grid data for a nickel laterite district and produces a ranked priority map: which grid cells are most prospective, what the geological reasoning is, and what legal/compliance status applies. Results render as a Leaflet.js map with color-coded priority classes (P1–P4) and a detailed per-target sidebar.

## Why it matters

Nickel laterite exploration generates large multi-parameter datasets (mag, geochem, lithology, remote sensing, legal). Manual integration is slow and inconsistent. NiTERRA automates the scoring pipeline with transparent geology-driven heuristics and, eventually, ML-driven prospectivity inference — turning raw field data into drill-ready targets in minutes.

## Who it is for

- **Exploration geologists** evaluating nickel laterite prospects
- **Hackathon judges** evaluating technical integration (AI/GIS/Data Analytics + ESG/Safety/Risk)
- **ANTAM Geomin** as a potential pilot for digital exploration workflow

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Leaflet.js |
| Backend | Python FastAPI |
| Database | PostgreSQL + PostGIS |
| ML | Scikit-Learn / XGBoost (planned) |
| Data | Realistic Halmahera (Weda Bay) nickel laterite dummy data |

## Key links

- `index.html` — SPA entry point
- `js/app.js` — frontend logic (scoring, rendering, API calls)
- `css/style.css` — dark volumetric design system
- `backend/app/main.py` — FastAPI backend entry
- `backend/ml/` — ML training and inference pipeline
- `data/study_grid_dummy.geojson` — 30-grid Halmahera dataset (H001–H030)
- `vault/geonirisk/` — this vault
- `vault/geonirisk/research/drilling-cost-benchmarks.md` — industry drilling cost data (MBMA, PT Arrahman)

## How AI should help

- **Never invent data.** If context is missing, ask.
- **Prefer deletion over addition.** Fewest files possible.
- **Trace the full flow** before editing a function — grep every caller first.
- **Flag shortcuts** with `ponytail:` comments and name the upgrade path.
- **Keep decisions in `decisions.md`**, not in conversation. If we decide something, log it.
- **Status lives in `STATUS.md`**. Always read it before starting work.
- **Log progress in `progress.md`** after every session.
