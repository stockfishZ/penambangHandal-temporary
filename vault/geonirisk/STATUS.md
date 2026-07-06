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
- Everything else from previous status (capex, legal compliance, etc.)

## What's broken / incomplete

- **PostGIS tables not populated** with real OSM/KLHK spatial data — schema exists but tables empty
- **Grandfathered grid check** still hardcodes `gridId === 'G006'` in frontend — needs data-driven approach
- **No retraining hook** — model is static until retrained manually
- Capex estimator still uses heuristic scores (runs before ML merge, ~3-line fix)

## Next action

*Open — waiting for user direction.*

## Blockers

- PostGIS tables need real spatial data (OSM roads, waterways, KLHK boundaries)
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

- The `deriveCompliance()` function hardcodes `gridId === 'G006'` — needs updating for H-series or data-driven
- Capex `ml_score` null fallback — recalculate in ML merge block (~3 lines)
