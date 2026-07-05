# STATUS

*Last updated: 2026-07-05 (evening)*

## Current state

The project has a working frontend prototype with hardcoded weighted-scoring heuristics (faking AI). Backend exists with FastAPI skeleton and PostGIS connectivity (Phase 1–2 complete). Dummy data was just migrated from Bandung (fake nickel area) to **Halmahera, Weda Bay** (real nickel laterite district).

## What works

- Frontend SPA with Leaflet map, ranking table, detail panel, summary cards
- Dummy data load (30 Halmahera grid cells, 65 mag readings, 60 geochem samples)
- Local weighted scoring pipeline (9 factors: magnetic, geochem, lithology, slope, road, river, legal, smelter, area)
- Legal compliance derivation (APL, HP, Hutan Lindung with permit/KB rules)
- Backend `/api/analyze-batch` endpoint accepting grid batches and returning ML scores
- Backend PostGIS spatial query stubs (roads, water, settlements, smelters, forestry)
- Backend grandfather-concession seed data
- **Drill capex estimator** — spacing (50/100m), hole count, meterage, Rp cost per grid. Calibrated with published industry data. Renders in detail panel below Final score.

## What's broken / incomplete

- **ML pipeline is not integrated.** Backend returns null/fallback scores. Frontend gracefully degrades to local scoring only.
- **Backend uses DummyDataService** — not real PostGIS data.
- **Expert labels CSV** still references old G-series IDs (not updated for H-series).
- **No real PostGIS spatial tables populated** — schema exists, tables are empty.
- **Frontend still owns all scoring logic** — supposed to be migrated to backend per the architecture plan.
- **Capex doesn't use real ml_score** when backend IS available — runs before ML merge. ~3-line fix in ML merge block.

## Next action

*Open — waiting for user direction.*

## Blockers

- No trained model artifact (`.joblib`/`.onnx`) — need synthetic training or real data.
- No labeled training dataset for Halmahera H-series grids.
- PostGIS tables need real spatial data (OSM roads, waterways, KLHK boundaries).

## Upcoming deadlines

| Date | Event |
|------|-------|
| 2026-07-10 | Proposal submission |
| 2026-07-15 | Finalist announcement |
| 2026-07-17 | Sprint & mentoring |
| 2026-07-22 | Final presentation & judging |
| 2026-08-11 | Demo Day & Awarding |

## Needs review

- The `deriveCompliance()` function hardcodes `gridId === 'G006'` for grandfathered status — needs updating for H-series or making data-driven.
- Expert labels need regenerating for the new Halmahera dataset if ML training is planned.
- Capex `ml_score` null fallback — recalculate in ML merge block once backend returns real scores (~3 lines in `runAnalysis()`).
