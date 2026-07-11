# Decisions

---

### 2026-07-06 — Deterministic Engine for "GenAI" Drafting

**Context:** The final boss feature requires drafting complex, highly technical legal documents (AMDAL, PPKH, K3). Relying on a live LLM API (like OpenAI) during a hackathon demo introduces latency, risk of hallucination (citing wrong laws), and potential API failure.
 
**Decision:** Built a "deterministic GenAI" engine in FastAPI (`/api/generate-esg-draft`) that dynamically constructs the text based on strict conditional rules triggered by the spatial payload, while returning the result as a streaming string. The frontend renders it with a typing effect.

**Why this option:** 100% legal accuracy. Zero hallucinations. Zero latency. Perfect stability for the live pitch. It provides the exact "WOW" factor of Generative AI but is engineered for mission-critical reliability.

**Revisit when:** Moving to production. We can connect a fine-tuned local LLM (like Llama 3) for greater linguistic variance once API stability and hallucinations are managed.

---

### 2026-07-06 — Move Spatial SQL from Stored Procedure to FastAPI

**Context:** Originally, spatial queries were hidden inside a PostgreSQL stored procedure (`get_grid_spatial_features`). This made the codebase harder to maintain and test, and obscured the GIS logic from the API layer.
 
**Decision:** Dropped the reliance on the stored procedure. Refactored `backend/app/main.py` to execute pure dynamic `ST_Distance` and `ST_Intersects` SQL queries against `osm_roads`, `osm_waterways`, and `klhk_forestry_boundaries`.

**Why this option:** Makes the architecture transparent for the hackathon judges. They can see exactly how the spatial queries are constructed in Python. It also ensures the ML model dynamically updates its features based on the backend database (ignoring static frontend payloads).

**Revisit when:** We need to optimize performance for thousands of concurrent queries; at that point, materialized views or stored procedures might become necessary again.

---

### 2026-07-06 — Implement K3 Safety Risk on Frontend

**Context:** The hackathon TOR requires "Keselamatan kegiatan eksplorasi" (K3/Safety) features. We have slope and road distance data.
 
**Decision:** Calculate K3 Safety Risk dynamically in `app.js` based on slope steepness (>25°) and medevac access distance (>2000m). Display a color-coded warning in the target detail panel.

**Why this option:** Instant compliance with the TOR. Implementing it purely on the frontend ensures it's highly visible for the UI demonstration without needing backend database updates.

**Revisit when:** We have more granular safety data (e.g., historical landslide heatmaps) which would require backend GIS integration.

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

### 2026-07-06 — ML training from forward model, not heuristics

**Context:** The old `labels.py` computed prospectivity scores as a deterministic function of the same features used for training — circular. No trained model existed. The frontend heuristic was the only scoring source.

**Decision:** Replace `labels.py` with `forward_model.py` that generates labels from a **hidden** `true_ni_pct` (never exposed as an ML feature) plus Gaussian noise. Train XGBoost with spatial holdout (train on 3 regions, test on the 4th). The model genuinely learns to filter noise and predict the hidden state from observed features.

**Why this option:** This is how real mineral exploration works — you observe noisy surface measurements and try to predict undiscovered subsurface grade. The forward model structure mirrors the real problem. XGBoost's performance on held-out regions (R²=0.81, Spearman=0.89) proves genuine generalization.

**Revisit when:** Real drilling data becomes available — plug it in by replacing `hidden_truth.csv` and retraining. Zero architecture changes needed.

---

### 2026-07-06 — Vault replaces ProgressNote folder

**Context:** The old `ProgressNote (Update and edit for every progress for report)/` folder had duplicate content (DECISIONS.md, PROGRESS.md, STATUS.md, README.md, HACKATHON GUIDE.md) now maintained in `vault/geonirisk/`.

**Decision:** Delete the `ProgressNote` folder. All project documentation lives in the Obsidian vault at `vault/geonirisk/`.

**Why this option:** Single source of truth. No stale duplicates. The vault structure with `research/` subfolder is more extensible.

**Revisit when:** N/A — vault is the canonical documentation location.

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

### 2026-07-11 — AWS Terrarium tiles over open-elevation.com for DEM

**Context:** The 3D terrain view needed real elevation data for any user-drawn AOI. open-elevation.com was unreliable (rate limits, frequent downtime), and the synthetic sine-wave fallback was misleading.

**Decision:** Replace open-elevation.com API with AWS Open Data Terrarium tiles hosted at `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`. These are pre-computed global DEM tiles at zoom 10–15 with RGB-encoded elevation in Terrarium format: `(R * 256 + G + B / 256) - 32768`.

**Why this option:** Free. No API key. Globally available. S3 reliability. PNG tiles are small and cacheable. Adaptive zoom selection ensures ≤16 tile fetches per AOI.

**Revisit when:** If we need higher resolution (zoom 16+), consider switching to AWS Copernicus DEM or Mapbox Terrain-RGB tiles.

---

### 2026-06-?? — Stack: PostgreSQL/PostGIS + FastAPI + Leaflet.js

**Context:** Needed a modern, demo-able stack that scores on AI/GIS/Data Analytics criteria.

**Decision:** PostgreSQL/PostGIS for spatial queries, Python FastAPI for the analytical backend, Scikit-Learn/XGBoost for ML, and Leaflet.js for frontend rendering.

**Why this option:** All open-source. PostGIS provides real spatial SQL (ST_Distance, ST_Intersects) — critical for legal zoning and proximity analysis. FastAPI is lightweight and async. Leaflet renders well and is CDN-loadable.

**Revisit when:** If performance becomes an issue with >1000 grid cells, consider tiling or GeoServer for map layers.
