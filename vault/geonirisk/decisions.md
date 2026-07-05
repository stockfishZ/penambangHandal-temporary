# Decisions

---

### 2026-07-05 — Use Halmahera (Weda Bay) as primary dummy dataset

**Context:** The original dummy data was located around Bandung/Jatinangor — a volcanic area with no nickel mineralization. The app claimed to be a nickel exploration tool but the demo data didn't reflect that.

**Decision:** Replace the three dummy data files in-place with a 30-grid dataset centered on the Weda Bay nickel laterite district, Halmahera. Grid IDs changed from G-series to H-series (H001–H030).

**Why this option:** Simplest change — zero code modifications. The "Load Dummy Data" button fetches the same filenames. Map auto-fits to new bounds.

**Revisit when:** If the ML training pipeline needs labeled data, expert labels need regenerating for H-series IDs.

---

### 2026-07-05 — Place Obsidian vault inside project repo

**Context:** Needed a persistent memory store for the hackathon project that travels with the code.

**Decision:** Create `vault/geonirisk/` inside the project root, with 4 core files (README.md, STATUS.md, progress.md, decisions.md). Single-project vault — no mixing projects.

**Why this option:** Keeps all context with the code. Can be committed. Doesn't depend on a separate Obsidian vault location.

**Revisit when:** If the vault grows beyond ~20 files, consider splitting into subfolders (e.g., `research/`, `meetings/`, `design/`).

---

### 2026-06-?? — Keep scoring logic in frontend for now

**Context:** The architecture plan (GEMINI.md) calls for migrating all scoring to the backend. But the backend ML pipeline isn't ready.

**Decision:** Frontend retains the weighted heuristic scoring as a fallback. Backend ML scores are merged on top when available. The frontend `buildResults()` function handles both cases.

**Why this option:** Demo-able today. The app works with or without the backend running. ML integration is additive, not blocking.

**Revisit when:** Phase 3 ML pipeline is operational and stable. Then strip scoring from `app.js` and make the backend the single source of truth.

---

### 2026-06-?? — Theme selection: Eksplorasi

**Context:** ANTAM Hackathon 2026 has 3 themes — Eksplorasi, Penambangan, Pengolahan Mineral.

**Decision:** Choose Eksplorasi (exploration targeting, prospectivity mapping, remote sensing).

**Why this option:** Team strengths align with geoscience data integration. The existing prototype already does grid-based targeting. Strong fit with the "Young Mining Innovators" brief.

**Revisit when:** N/A — theme is locked for the competition.

---

### 2026-07-05 — Capex estimator built frontend-only, calibrated with industry data

**Context:** NEW MILESTONE.md specified a backend API pipeline for drill capex calculation. But all inputs (`area_ha`, `mag_std`, `priority_score`) are already client-side in `resultRows`.

**Decision:** Implement `computeCapex()` and rendering entirely in `app.js`. No backend changes, no new endpoints, no new files beyond the single JS function + 3 UI rows.

**Why this option:** Works offline (backend not required). Zero new dependencies. Matches the existing pattern where frontend owns scoring. The `ml_score` null fallback to `priority_score` means it works even when the ML pipeline is down.

**Calibration:** Replaced spec's guessed values (Rp 750.000/m, 20m depth) with industry data:
- Rp 1.000.000/m — midpoint of PT Arrahman 2025 full-coring rate card (Rp 800K–1.5M)
- 25m depth — conservative exploration average per multiple industry sources
- 50m/100m spacing validated by MBMA Konawe campaign data

Sources logged in `vault/geonirisk/research/drilling-cost-benchmarks.md`.

**Revisit when:** Backend ML pipeline returns real `ml_score`. Then recalculate capex in the ML merge block at `app.js:195` to use real scores instead of the priority_score fallback.

---

### 2026-06-?? — Stack: PostgreSQL/PostGIS + FastAPI + Leaflet.js

**Context:** Needed a modern, demo-able stack that scores on AI/GIS/Data Analytics criteria.

**Decision:** PostgreSQL/PostGIS for spatial queries, Python FastAPI for the analytical backend, Scikit-Learn/XGBoost for ML, and Leaflet.js for frontend rendering.

**Why this option:** All open-source. PostGIS provides real spatial SQL (ST_Distance, ST_Intersects) — critical for legal zoning and proximity analysis. FastAPI is lightweight and async. Leaflet renders well and is CDN-loadable.

**Revisit when:** If performance becomes an issue with >1000 grid cells, consider tiling or GeoServer for map layers.
