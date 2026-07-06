# STATUS

*Last updated: 2026-07-06*

## Current state

The ML pipeline is now **genuine machine learning**. XGBoost is trained on 230 cells (NE, NW, SW) and achieves R²=0.812 / Spearman=0.889 on the spatially held-out SE region. The forward model breaks the circular dependency by computing labels from hidden `true_ni_pct` (stored in `hidden_truth.csv`, never exposed as a feature). Frontend uses ML scores as the primary scoring source when the backend is available, with heuristic fallback.

## What works

- **Real ML pipeline**: XGBoost trains on 400 cells, generalizes to unseen regions (proven by spatial holdout)
- **Forward model**: Stochastic labels from hidden ground truth + Gaussian noise
- **Inference**: `model.pkl` loads, returns real scores + confidence + per-grid feature importance
- **`GET /api/model-info`** endpoint returns model status, features, CV scores, training date
- Frontend uses ML score as **primary** when backend available (×10 to 0–100 scale), heuristic fallback
- All data generation assumptions documented with citations in `research/SOURCES.md`
- **Downstream Integration (RKEF vs HPAL)** and **K3 Safety Risk** scoring implemented in frontend
- **Real Spatial SQL (PostGIS)**: The backend dynamically computes `ST_Distance` and `ST_Intersects` against OSM roads, waterways, and KLHK forestry boundaries seeded via `seed_osm.py`.
- **Performance Optimizations**: Resolved N+1 PostgreSQL bottleneck via `unnest()` in batch queries, eliminated double frontend data aggregation, and fully integrated ML `cv_score` into Capex calculations.
- **Generative AI ESG Drafter**: A deterministic generative engine outputs customized, legally accurate (AMDAL/PPKH) mitigation strategies based on spatial grid payloads directly to the frontend.
- **Upstream Target Generation Pipeline (NEW)**: Fully functional client-side 3-stage platform connecting macro-level remote sensing (`remote-sensing.html`) to predictive 3D terrain modeling (`terrain-analysis.html`) and economic site assessment (`site-assessment.html`). This acts as the "GO/NO-GO" gateway before launching the drone geophysics payloads.
- Everything else from previous status (capex, backend QA/QC data sanitization, legal compliance, etc.)

## What's broken / incomplete

- **No retraining hook** — model is static until retrained manually
- **Drone hardware telemetry** — `droneGeophysics.py` is currently a standalone Python script, not yet piping real-time UDP streams into the NiTERRA web backend.

## Next action

*Integrate hardware telemetry streams from droneGeophysics.py into the backend, or polish the presentation for pitch.*

## Blockers

- No mechanism to incorporate new training data without manual retraining

## Upcoming deadlines

| Date | Event |
|------|-------|
| 2026-07-10 | Proposal submission |
| 2026-07-15 | Finalist announcement |
| 2026-07-17 | Sprint & mentoring |
| 2026-07-22 | Final presentation & judging |
| 2026-08-11 | Demo Day & Awarding |

## Needs review

- None at the moment.
