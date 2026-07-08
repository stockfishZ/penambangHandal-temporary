# NiTERRA — NEW MILESTONE

## Vision

A single exploration page. Free-roaming heat map of Indonesia's nickel potential. Draw a rectangle to grab a chunk → that chunk becomes a candidate exploration zone → 3D terrain loads → ML results appear below. All in one place.

## Team Split

| Point | Who | What |
|-------|-----|------|
| 1 | **NiTERRA UI** | Regional nickel heat map — WHERE in Indonesia has nickel laterite potential |
| 2 | **NiTERRA UI** | Site screening — is this area SAFE, PROBABLE, WORTH IT? → decide where to deploy drone |
| 3-5 | **Teammates** | Drone magnetometer (`droneGeophysics.py`), geochemistry sampling, data interpretation |

The UI produces a ranked list of grid cells (export CSV) that the geophysicist hands to the drone team. Their real field data flows back separately — no synthetic data generated here.

## Architecture: One Page, Two Modes

### `terrain-analysis.html`

**BROWSE mode** (initial state):
- Full Indonesia map centered on Sulawesi/Halmahera
- **OpenStreetMap basemap** (cleaner than OpenTopoMap — belt polygons visible without contour clutter)
- Nickel belt polygons (ophiolite outlines) colored by tier — **fill opacity 0 (outline only), dashed border** — clearly distinguishable from forestry's solid filled polygons
- **Forestry boundaries overlay** (Hutan Lindung / Hutan Produksi / APL) — approximate polygons visible before drawing, so users see where prohibited areas are *before* selecting an area. APL uses **indigo (#6366f1)** to avoid confusion with belt greens.
- **Combined bottom-left legend** — two sections: Sabuk Nikel (tier-colored lines: High/Medium/Low) + Kawasan Hutan (filled rectangles: Hutan Lindung/Hutan Produksi/APL)
- Mine/mindat locality markers
- Toolbar: `[Select Area]` toggle, layer checkboxes (Geology, MPM, Slope)

**TARGET mode** (after rectangle drawn):
- Map zooms to selected area, study grid overlay appears
- Grid cells **color-coded by legal_status**: green (APL/allowed), gold (Hutan Produksi/conditional), red (Hutan Lindung/no-go) — no guesswork on where forbidden zones are
- Bottom panel slides up with 4 tabs:
  - **Assessment**: SAFE / PROBABLE / WORTH IT scores with rubric breakdown + **compliance summary** (X cells blocked, Y conditional, Z clear). Overall: GO / CONDITIONAL / NO-GO. Banner downgrades if any no-go cells detected.
  - **3D Terrain**: Plotly surface, procedural elevation, slope-colored by laterite suitability. Lazy-rendered on first tab click (fixes hidden-container sizing issue).
  - **ML Prediction**: Per-cell Ni grade overlay (colored by forward-model prediction) + **summary metrics row**: total cells × high/medium/low counts + top target ID. Source note: "Forward model based on Van der Ent et al. lithology Ni ranges."
  - **Drone Export**: Top 20 ranked cells by prospectivity × safety, CSV download in drone-compatible format

### Navigation

```
Before:  Intro | Peta Potensi | Analisis Terrain | Penilaian | Ruang Kerja
After:   Intro | Eksplorasi   | Analisis
```

- `Eksplorasi` → the single exploration page (above)
- `Analisis` → links to `index.html` (landing page)

## Data

### Nickel Belt Heat Map (`data/indonesia_nickel_belts.geojson`)
Approximate polygon outlines of Indonesia's laterite-hosting ophiolite belts, derived from published geological map boundaries. Each polygon carries `tier` and `source` properties. DRAFT — user reviews before finalizing.

### Client-Side Grid Generator (`js/grid-gen.js`)
Grid generation logic ported from `generate_site_data.py` to JavaScript. Runs entirely in the browser — no backend needed. When user draws a rectangle:
1. Find nearest known site or default to ROLLING/LOW
2. Generate 20×20 cells with terrain-adaptive cell size, tier-weighted lithology
3. Return GeoJSON + computed assessment scores

### Files Kept
- `data/all_sites/*.geojson` — Phase 1 regional layers (geology, slope, remote_sensing, mpm)
- `data/{site}/study_grid.geojson` — targeting grid per site (for demo/overlap scenarios)
- `data/{site}/hidden_truth.csv` — ML training reference
- `js/shared-sites.js` — 8 known nickel districts (coordinates corrected per Mindat sources)

### Files Deleted
- `remote-sensing.html`, `js/remote-sensing.js` — superseded by single page
- `site-assessment.html`, `js/site-assessment.js` — superseded by single page
- `data/*/magnetometer.csv`, `data/*/geochemistry.csv` — synthetic field data removed (teammates' domain)

## Assessment Rubric

| Score | Weights | Range |
|-------|---------|-------|
| **SAFE** | slope (40%) + road access (30%) + terrain penalty (30%) | 0–100 |
| **PROBABLE** | ultramafic % (40%) + tier (30%) + belt proximity (30%) | 0–100 |
| **WORTH IT** | area ha (30%) + smelter dist (30%) + tier (40%) | 0–100 |
| **OVERALL** | SAFE×0.3 + PROB×0.4 + WORTH×0.3 | 0–100 |

GO ≥ 75 | CONDITIONAL 50–74 | NO-GO < 50

## Completed Refinements (2026-07-07)

1. **Header solid** — topbar background `var(--bg-surface)` (no map bleed-through)
2. **Switch to OSM basemap** — cleaner tiles, belts visible immediately
3. **Raise belt opacity** — fill 0.25, solid lines
4. **Brighter tab fonts** — inactive tabs use `--text-primary`
5. **Lazy 3D** — Plotly renders on first tab click (fixes zero-size container)
6. **ML summary metrics** — 5 metric cards in ML Prediction tab (total cells × high/med/low counts × top target)
7. **Compliance map overlay** — grid cells colored by `legal_status` (indigo/APL, gold/HP, red/HL)
8. **Compliance in assessment** — blocked cell counts, banner adjusts if no-go cells found
9. **Forestry boundaries GeoJSON** — `data/forestry_boundaries.geojson` with 8 approximate Hutan polygons (3 HL, 3 HP, 2 APL) loaded in BROWSE mode with combined legend
10. **ML source note** — links to SOURCES.md
11. **APL color → indigo (#6366f1)** — avoids confusion with belt green tones
12. **Combined legend** — single block shows both belt tier lines + forestry filled swatches
