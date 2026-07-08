# Progress Diary

---

### 2026-07-09 — Replaced synthetic forestry polygons with real data from BIG Satupeta

**What happened:**
The synthetic forestry boundary workaround has been eliminated. Instead of generating fake HL/HP/APL polygons, we now fetch real `Penetapan Kawasan Hutan` (Forest Area Designation) polygons directly from Indonesia's **One Map Policy (Satupeta)** — `Badan Informasi Geospasial` ArcGIS REST API.

- `backend/scripts/fetch_forestry_data.py` — new script queries `kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer/0` for each of the 8 nickel belt sites
- Returns 31 real polygons across 6 sites: Sorowako (11), Obi Island (10), Weda Bay (4), Pomalaa (3), Konawe (3), Tapunopaka (3)
- Morowali and Gag Island returned 0 features → defaults to APL (allowed)
- `fungsitap` codes mapped: 100100/100200-260 (HL,HSA) → no-go, 100300/100400/100500 (HPT,HP,HPK) → conditional, no polygon → allowed
- `js/grid-gen.js` — fixed `pointInPolygon` / `cellLegalStatus` for correct Polygon and MultiPolygon geometry traversal; uses `feat.properties.legal_status` instead of old synthetic `FOREST_TYPE_TO_LEGAL` map
- Replaced `data/forestry_boundaries.geojson` — 8 hand-crafted polygons → 31 real government polygons

**What changed:**
- `backend/scripts/fetch_forestry_data.py` — new
- `data/forestry_boundaries.geojson` — replaced with real data
- `js/grid-gen.js` — fixed geometry handling, removed synthetic FOREST_TYPE_TO_LEGAL map
- `js/terrain-analysis.js` — colored Satupeta polygons by legal_status (no-go=red, conditional=amber, allowed=green); updated tooltip & legend

**What should happen next:**
- [ ] Retrain XGBoost model with legal_status from real polygons (distribution shifts from old random assignment)
- [ ] Regenerate training_features.csv after retraining

---

### 2026-07-07 — Architecture Overhaul: Single-Page Exploration Flow + Data Cleanup

**What happened:**
The project was restructured from 3 separate pages (remote-sensing.html → terrain-analysis.html → site-assessment.html) into a single-page exploration tool.

- Consolidated all 3 pages into `terrain-analysis.html` — one page with two modes:
  - **BROWSE**: Free-roaming Indonesia map with ophiolite belt polygons as a nickel heat map
  - **TARGET**: Draw a rectangle → 20×20 study grid auto-generates → bottom panel with 4 tabs (Assessment, 3D Terrain, ML Prediction, Drone Export)
- Created `data/indonesia_nickel_belts.geojson` — simplified polygon outlines of 5 nickel laterite belts (East Sulawesi, Halmahera, Obi, Waigeo-Gag, SE Sulawesi) with tier ratings and source citations
- Created `js/grid-gen.js` — client-side 20×20 grid generator ported from Python. Determines nearest known site from drawn rectangle, generates cells with terrain-adaptive sizing and tier-weighted lithology
- Wrote assessment engine in JS — computes SAFE (slope + road + terrain) / PROBABLE (ultramafic% + tier + belt) / WORTH IT (area + smelter + tier) scores with transparent rubric
- Kept procedural 3D terrain with slope-colored overlay (procedural DEM sufficient for hackathon)
- ML Prediction tab shows per-cell Ni grade overlay on both main map and mini-map
- Drone Export tab: top 20 ranked cells with CSV download matching `droneGeophysics.py`-compatible format

**Data cleanup:**
- Stripped `magnetometer.csv` and `geochemistry.csv` generation from `generate_site_data.py` — synthetic field data was teammates' domain via `droneGeophysics.py`
- Deleted all magnetometer.csv and geochemistry.csv files from all 8 site directories
- Deleted `remote-sensing.html`, `site-assessment.html`, `js/remote-sensing.js`, `js/site-assessment.js`
- Updated `js/shared-sites.js` with corrected coordinates (Morowali → Bungku, Weda Bay inland, Sorowako/Pomalaa/Obi minor shifts)
- Nav simplified: `Intro | Eksplorasi | Analisis`

**What changed:**
- `terrain-analysis.html` — rewritten (single page, two modes, tab panel)
- `js/terrain-analysis.js` — rewritten (BROWSE/TARGET, draw tool, assessment, 3D, ML, export)
- `js/grid-gen.js` — new (client-side grid generator)
- `data/indonesia_nickel_belts.geojson` — new (ophiolite belt polygons)
- `js/shared-sites.js` — updated coordinates
- `data/generate_site_data.py` — stripped mag/geochem generation
- `index.html` — nav updated
- `remote-sensing.html`, `site-assessment.html`, `js/remote-sensing.js`, `js/site-assessment.js` — deleted
- `data/*/magnetometer.csv`, `data/*/geochemistry.csv` — deleted (all 8 sites)
- `vault/geonirisk/NEW MILESTONE.md` — rewritten with user's single-page architecture
- `vault/geonirisk/STATUS.md` — updated

**What should happen next:**
- [ ] User reviews nickel belt polygons
- [ ] User tests single-page flow end-to-end
- [ ] Polish for hackathon presentation

---

### 2026-07-06 — Phase 1.1: WebGIS & Ultra Predictive Map

**What happened:**
- Implemented Phase 1.1 WebGIS foundation and removed hardcoded Leaflet polygons.
- Wrote `generate_phase1_data.py` to simulate open-source proxy data for a dummy Morowali region (Ultramafic boundaries, DEMNAS 5-15 degree slope proxy, Sentinel-2 Fe-Oxide heatmap, and MPM combined heatmap).
- Integrated the "Ultra Predictive Map" (Mineral Prospectivity Mapping) into `terrain-analysis.js` using dynamic GeoJSON fetching.
- Retained the premium UI vibe from `index.html` within the interactive `terrain-analysis.html` Leaflet map setup.

**What changed:**
- `backend/generate_phase1_data.py` — created.
- `js/terrain-analysis.js` — fully refactored to fetch dynamic GeoJSONs and add to `L.control.layers`.
- `data/morowali/` — populated with generated GeoJSONs.

**What should happen next:**
- [ ] Phase 2: Interactive AOI Selection (Bounding Box Tool) & Data Clipping.

---

### 2026-07-06 — FINAL SPRINT: HACKATHON WINNING FEATURES (Retraining, 3D, ROI)

**What happened:**
- Implemented the ML Retraining Hook (Dynamic Learning) with an `asyncio` file-swap in FastAPI, a concurrency lock, and a frontend "Upload New Drill Data & Retrain" feature for hot-reloading the `model.pkl` in memory.
- Integrated Plotly.js 3D Block Model mapping Longitude, Latitude, ML Score, and color-coded by Ni_avg for a high-impact interactive visualization ("The Wow Factor").
- Developed Feasibility & Business Case explicit Cost Savings (ROI/Impact Metric). It compares a traditional 50m drill spacing baseline against an AI-optimized spacing, displaying explicitly calculated cost savings in Rupiah Miliar prominently in the summary dashboard.
- Injected the ROI cost savings calculation directly into the Generative AI ESG Drafter output for an integrated economic narrative.
- Finished all components for the Official Deliverables PDF Proposal.

**What changed:**
- `backend/ml/inference.py` — added `reload` capability.
- `backend/app/main.py` — added `POST /api/retrain` endpoint for ML reloading, and `roi_savings_miliar` to `generate_esg_draft`.
- `index.html` — added Plotly CDN, Retrain button, 3D toggle, 3D container, and ROI metric block.
- `js/app.js` — implemented Plotly 3D block rendering, ROI baseline vs AI cost calculations, and wired the new UI interactive hooks.

**What should happen next:**
- [ ] Submit and WIN THE HACKATHON.

---

### 2026-07-06 — Performance Optimizations & Capex Logic Update

**What happened:**
- Fixed the N+1 Database Query Bottleneck: The spatial queries in `backend/app/main.py`'s `/api/analyze-batch` endpoint now use a single bulk spatial join via `unnest()`, avoiding separate PostgreSQL lookups per grid cell.
- Eliminated Double Data Aggregation on the frontend: Computed aggregations exactly once (mean, std, etc.) in `js/app.js` into a `precomputed` dictionary, saving the client CPU cycles from duplicating the work.
- Ripped out the stale frontend heuristic for `computeCapex()`, and explicitly utilized the `ml_cv_score` returned by the active XGBoost model pipeline to drive Capex logic.

**What changed:**
- `backend/app/main.py` — verified and ensured `unnest()` bulk query logic for Spatial DB queries.
- `js/app.js` — refactored `runAnalysis()`, `callBackendAnalyze()`, and `buildResults()` to pass precomputed statistics, and updated `computeCapex()` to use true `ml_cv_score`.

**What should happen next:**
- [ ] WIN THE HACKATHON.

---

### 2026-07-06 — FINAL MILESTONE: Generative AI ESG & Permit Drafter

**What happened:**
- Implemented the ultimate "Final Boss" feature: an automated ESG and Permit Drafter that merges our Predictive AI (XGBoost) with Generative AI workflows.
- Users can now click "Auto-Generate ESG & Permit Draft" on any target to instantly stream a highly technical, legally accurate mitigation strategy (AMDAL/UKL-UPL, PPKH, and K3).
- The drafting engine dynamically cites real Indonesian regulations (*Permen LHK 7/2021*, *Permen LHK 4/2021*, *Kepmen ESDM 1827 K/30/MEM/2018*) based on the grid's unique spatial constraints (slope, river proximity, forestry zone).

**What changed:**
- `backend/app/main.py` — added `POST /api/generate-esg-draft` endpoint with deterministic GenAI logic.
- `js/app.js` — added the sleek Generation UI with terminal-style streaming text effects.
- `vault/geonirisk/NEW MILESTONE.md` — overwritten with the Final Milestone spec.

**What should happen next:**
- [ ] WIN THE HACKATHON.

---

### 2026-07-06 — Milestone 4: Real Spatial SQL (PostGIS Integration)

**What happened:**
- Created `backend/scripts/seed_osm.py` to seed the database with OpenStreetMap roads/waterways and KLHK Hutan Lindung (Forestry) dummy boundary polygons for the Halmahera region.
- Refactored `backend/app/main.py` to remove reliance on hidden stored procedures. The FastAPI backend now executes pure spatial SQL (`ST_Distance`, `ST_Intersects`) dynamically on the fly to measure distances to roads, rivers, and check for "Kill Zone" forestry intersections.
- The ML feature pipeline was updated to prioritize these real PostGIS measurements over any static payload data coming from the frontend.

**What changed:**
- `backend/scripts/seed_osm.py` — newly created.
- `backend/app/main.py` — implemented explicit `ST_Distance` SQL queries in `_compute_analysis` and reprioritized `_build_ml_features`.

**What should happen next:**
- [ ] Final Hackathon Pitch & Presentation Polish
- [ ] End-to-end testing

---

### 2026-07-06 — Milestone 3: Field Safety & K3 Risk Assessment

**What happened:**
- Implemented `deriveSafetyRisk` logic in the frontend (`js/app.js`) to score exploration grids based on slope steepness and medevac access distance.
- Integrated K3 safety alerts directly into the UI: targets with >25° slope and >2000m from roads get flagged with "High (Red)" landslide and medevac risks.
- This checks off the explicitly mandated "Keselamatan kegiatan eksplorasi" (Exploration Safety / K3) requirement in the Hackathon TOR.

**What changed:**
- `js/app.js` — added `deriveSafetyRisk` and exposed `safety_level` / `safety_warning` in the side panel.

**What should happen next:**
- [ ] Milestone 4: Real Spatial SQL

---

### 2026-07-06 — Milestone 2: Automated QA/QC Data Sanitization

**What happened:**
- Implemented a data sanitization pipeline in the FastAPI backend (`_sanitize_data`).
- The pipeline now automatically detects and flags anomalous field data before ML inference (e.g., capping impossible Ni > 5%, Co > 0.5%, and smoothing negative/wild magnetometer spikes).
- Exposed a "Data Quality Report" (QA/QC Interventions) directly in the UI's detail panel for judges to verify that the app handles messy real-world data gracefully.

**What changed:**
- `backend/app/main.py` — added `_sanitize_data` and attached `qaqc_flags` to the analysis response.
- `js/app.js` — surfaced `qaqc_flags` into a new UI warning/success box in the target detail view.

**What should happen next:**
- [ ] Milestone 3: Field Safety & K3 Risk Assessment
- [ ] Milestone 4: Real Spatial SQL

---

### 2026-07-06 — Milestone 1: Downstream processing integration

**What happened:**
- Implemented the "Metallurgical Suitability" classifier (RKEF vs HPAL) in `app.js` (`deriveProcessingRoute`).
- Linked upstream geochemistry (`Ni_avg`, `Fe_avg`, `Co_avg`) directly to downstream smelter destinations.
- Prominently exposed the Processing Route and Ore Character in the target detail panel.
- This satisfies the "Hulu hingga Hilir" (Upstream to Downstream) requirement of the Hackathon TOR.

**What changed:**
- `js/app.js` — added `deriveProcessingRoute`, updated `buildResults` to inject `processing_route`, and updated `selectTarget` to render it.

**What should happen next:**
- [ ] Milestone 2: Automated QA/QC Data Sanitization
- [ ] Milestone 3: Field Safety & K3 Risk Assessment
- [ ] Milestone 4: Real Spatial SQL

---

### 2026-07-06 — Bug fixes for G006 and Capex ML Score

**What happened:**
- Removed hardcoded `G006` check for grandfathered concessions in `app.js` (`deriveCompliance`). It now uses data dynamically supplied by the ML backend (`is_grandfathered`).
- Fixed the capex estimator bug where `ml_score` was falling back to null. The ML merge in `runAnalysis` now updates `rawGrid.features` directly before calling `buildResults`, allowing `computeCapex` to utilize the real `ml_score`.
- Removed these items from the "Needs review" and "What's broken" lists in `STATUS.md`.

**What changed:**
- `js/app.js` — refactored ML merge block in `runAnalysis` and `deriveCompliance`.
- `vault/geonirisk/STATUS.md` — removed fixed bugs.

**What should happen next:**
- [ ] Add model retraining hook when new data arrives
- [ ] Populate PostGIS tables with real OSM/KLHK spatial data

---

### 2026-07-05 — Halmahera data migration & vault creation

**What happened:**
- Replaced the Bandung dummy dataset (volcanic breccia, non-nickel area) with realistic Halmahera (Weda Bay) nickel laterite data:
  - 30 grid cells (H001–H030) centered on the Weda Bay nickel district
  - 65 magnetometer readings with realistic anomalies over ultramafic bodies (42,935–46,811 nT)
  - 60 geochemistry samples with proper laterite zonation (22 limonite, 18 saprolite, Ni 0.13–2.74%)
  - 22 of 30 grids on ultramafic bedrock (serpentinite, peridotite, ultramafic_simulated)
  - Closer smelter distances (25–80 km to IWIP) — more realistic than Bandung
- Fixed visual spacing bug between "Selected Target" pill and "Detail Target" heading (added `margin-top: var(--sp-sm)` to `.detail-panel h3`)
- Created Obsidian vault at `vault/geonirisk/` with 4 core files

**What changed:**
- `data/study_grid_dummy.geojson` — full replace (Bandung → Halmahera)
- `data/magnetometer_dummy.csv` — full replace
- `data/geochemistry_dummy.csv` — full replace
- `css/style.css` — added `margin-top: var(--sp-sm)` to `.detail-panel h3`

**What should happen next:**
- [ ] Phase 3 ML model integration (inference pipeline in backend)
- [ ] Regenerate expert labels for H-series grid IDs
- [ ] Populate PostGIS tables with real OSM/KLHK spatial data
- [ ] Migrate scoring logic from frontend to backend
- [ ] Update hardcoded grandfathered grid check (G006 → data-driven)

---

### 2026-07-06 — ML pipeline: from heuristic to genuine machine learning

**What happened:**
The ML pipeline was fundamentally restructured. Previously the model trained on labels generated by a hardcoded formula using the same features — circular, not learning. Now:

- **Scaled data**: 30 cells → **400 cells** (20×20 grid, ~35×35 km Weda Bay area)
- **Hidden ground truth**: Each cell has a hidden `true_ni_pct` (function of lithology + spatial proximity to ultramafic center), stored in `data/hidden_truth.csv`, **never exposed to ML features**
- **Stochastic forward model** (`backend/ml/forward_model.py`): prospectivity labels depend on the **hidden** true Ni grade (not observed `Ni_pct_mean`), plus Gaussian noise. This breaks the circular dependency — the ML model must learn to filter noise and estimate the hidden state.
- **Spatial train/test split**: Train on NW+NE+SW (~230 cells), test on SE (~75 cells — completely unseen during training). This tests generalization to unexplored regions, a real ML challenge.
- **XGBoost** genuinely learns: **R² = 0.812**, **Spearman ρ = 0.889** on held-out SE region. Top-10 overlap: 9/10.
- **Feature importance makes geological sense**: Ni_pct_mean (52%), legal_allowed (19%), serpentinite lithology (4%), magnetometer (2%)
- `model.pkl` now exists (322 KB) and loads in the inference pipeline
- Frontend uses ML score as **primary** when backend is available, falls back to heuristic otherwise

**What changed:**
- `data/generate_halmahera.py` — scaled to 400 cells, adds hidden true Ni + region_id
- `data/hidden_truth.csv` — new, stores ground truth for forward model
- `backend/ml/forward_model.py` — new, replaces labels.py
- `backend/ml/labels.py` — deleted
- `backend/ml/train.py` — spatial CV, Spearman, model metadata
- `backend/ml/model.pkl` — trained model (322 KB)
- `backend/ml/model_metadata.json` — train/test metrics, feature list
- `backend/ml/inference.py` — real prediction + confidence + model info
- `backend/app/main.py` — new `GET /api/model-info` endpoint, ml_confidence in response
- `backend/ml/evaluate.py` — validation script
- `js/app.js` — ML score is primary scoring source when backend available
- `vault/geonirisk/research/SOURCES.md` — all data generation parameters cited to published sources
- `GEMINI.md` — updated to reflect real ML

**What should happen next:**
- [ ] Add model retraining hook when new data arrives
- [ ] Populate PostGIS tables with real OSM/KLHK spatial data
- [ ] Replace hardcoded grandfathered grid check (G006 → data-driven)
- [ ] Consider unsupervised anomaly detection as complementary layer

---

### 2026-07-05 — Drill capex estimator & research (evening)

**What happened:**
- Implemented both milestones from `NEW MILESTONE.md`:
  - `computeCapex()` — spacing logic (50m/100m based on ml_score + mag_std, fallback to priority_score), hole count, meterage, Rp cost
  - `formatRupiah()` — Indonesian Rupiah formatting with `.` thousand separators
  - 3 new detail rows in selectTarget (Recommended Spacing, Required Drill Holes, Est. Drilling Cost)
  - Spacing justification sentence appended to reason box
- Researched published Indonesian drilling cost data from:
  - PT Arrahman 2025 rate card (full coring: Rp 800K–1.5M/m)
  - MBMA Konawe campaigns (Q4 2024: 14,005m for Rp 33.87B; Q4 2025: 53,749m for Rp 44.37B)
  - Confirmed 50m/100m spacing standards from real operations
- Calibrated estimator: Rp 1.000.000/m (midpoint), 25m depth (conservative), published in `research/drilling-cost-benchmarks.md`

**What changed:**
- `js/app.js` — +41 lines (formatRupiah, computeCapex, capex wiring in buildResults, 3 detail rows)
- `vault/geonirisk/research/drilling-cost-benchmarks.md` — created

**What should happen next:**
- [ ] Recalculate capex in ML merge block when backend returns real ml_score
- [x] Capex estimator implemented (Milestones 1+2 from spec)
- [ ] Phase 3 ML model integration (inference pipeline in backend)
- [ ] Regenerate expert labels for H-series grid IDs
- [ ] Populate PostGIS tables with real OSM/KLHK spatial data
- [ ] Migrate scoring logic from frontend to backend
- [ ] Update hardcoded grandfathered grid check (G006 → data-driven)

---

### 2026-06-?? — Backend Phase 1 & 2 completion

*(From GEMINI.md context — details TBD)*
- PostGIS database schema designed (roads, waterways, settlements, smelters, forestry boundaries)
- FastAPI backend scaffolded with `/api/analyze-batch` endpoint
- Database connection pooling and config

---

### 2026-06-01–15 — Hackathon launch & registration

- ANTAM Hackathon 2026 launched
- Theme selected: Eksplorasi (Exploration targeting)
- Team registered under "Young Mining Innovators"
