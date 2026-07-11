# Progress Diary

---

### 2026-07-09 — ML terrain analysis overhaul: scoring fix, lithology expansion, hole-ring bugfix

**What happened:**
After user reported ML predictions not matching expectations since real forestry data landed, a comprehensive audit found 4 issues and 1 UX gap. Research was done on the overlap between nickel potential and forestry permit status — see `research/nikel-potensi-vs-perizinan.md`.

**Key finding from research:**
82% of Indonesia's nickel laterite deposits overlap with natural forest. Conditional (HP/HPT) zones cover ~50-60% of deposit area — these are administratively feasible via PPKH, not technical dead zones. The original ML scoring punished conditional cells too harshly.

**Changes:**

1. **Fixed `cellInAnyPolygon` hole ring bug** (`js/grid-gen.js:52-59`):
   - Old: iterated ALL rings (outer + holes), returned `true` if point in ANY ring — cells inside polygon holes (exclaves of non-forest within forest area) got wrong `legal_status`.
   - New: checks outer ring first, then verifies point is NOT in any hole ring before returning `true`.

2. **Adjusted legal scoring** (`js/ml-client.js:24-30`):
   - `conditional`: 3.0 → **4.5** (PPHK is administrative, not geological barrier)
   - `unknown`: 1.0 → **2.0** (conservative but not prohibitive)
   - Legal importance weight: 0.35 → **0.30** (balanced with lithology)
   - Lithology importance: 0.28 → **0.30** (geology matters equally to permits)
   - Justification: research confirmed conditional zones are ~50-60% of deposit area and routinely obtain PPKH (Pinjam Pakai Kawasan Hutan).

3. **Consistent slope function** (`js/ml-client.js:49-50`):
   - ML now uses same step thresholds as assessment engine: <8°=100, 8-15°=70, 15-20°=40, >20°=10 (scaled to 0-1.5 range)
   - Old ML used a triangular function (peak at 8°, linear decay) — different from assessment, confusing users.

4. **Expanded lithology types** (`js/grid-gen.js:9-14`, `js/ml-client.js:6-22`):
   - From 5 generic types → **11 geologically-specific types**
   - Added: harzburgite, dunite, lherzolite, pyroxenite, gabbro, basalt
   - Each with appropriate prospectivity score (3.0 for top ultramafics down to 1.2 for basalt)
   - Tier weights redistributed across 11 types with verified sum=1.0

5. **Score breakdown in ML Prediction tab** (`js/terrain-analysis.js:600-620`):
   - New "Breakdown Skor — Sel Terbaik" section shows stacked horizontal bars for top cell
   - Each feature (legal, lithology, slope, road, smelter) visualized with color-coded bar
   - User can see exactly why a cell scored what it did

6. **Updated ultramafic detection** across `terrain-analysis.js`:
   - `isUltraDominant` and lithology highlight lists now include all 7 ultramafic types
   - Consistent across lithology breakdown, top/bottom cell analysis

**What changed:**
- `js/grid-gen.js` — `cellInAnyPolygon` hole-ring fix; lithology array 5→11; tier weights redistributed
- `js/ml-client.js` — legal scoring 3.0→4.5, unknown 1.0→2.0; LITH_SCORE expanded; slope function aligned; importance weights rebalanced
- `js/terrain-analysis.js` — score breakdown UI; ultramafic detection lists updated
- `research/nikel-potensi-vs-perizinan.md` — new research summary

**What should happen next:**
- [ ] Consider converting heuristic to a lightweight decision tree trained on real data
- [ ] Add 13-exemption metadata flag for users with grandfathered CoW access to no-go zones

---

### 2026-07-09 — Belt-polygon tiled scan for full Sulawesi forestry coverage

**What happened:**
The point-based forestry fetch only covered ~0.2° around each known site, missing large areas of the Sulawesi ophiolite belts. Refactored `fetch_forestry_data.py` with a dual strategy:

- **Sulawesi belts** (East Sulawesi Ophiolite Belt + Southeast Sulawesi Nickel District): Tiled scan using 0.3°×0.3° envelopes (204 tiles total across both belts), pre-filtered by belt polygon intersection to skip empty tiles. Each tile queries BIG Satupeta ArcGIS REST API.
- **Non-Sulawesi sites** (Obi, Weda Bay, Gag): point-based queries at known coordinates (unchanged).
- **Dedup**: by `objectid`, belt scan takes priority — site queries for Sorowako, Pomalaa, Konawe, Tapunopaka naturally dedup to belt_scan.
- **Post-filter**: belt_scan features filtered to keep only those whose centroid falls inside a Sulawesi belt polygon (removed 29 outliers).
- **Bugfix on first run**: post-filter was incorrectly removing non-Sulawesi site features too (filtered all centroids against Sulawesi belts). Fixed to only filter `tile_source == belt_scan` features.
- **Print encoding**: replaced Unicode → (U+2192) with ASCII `-` for Windows cp1252 compatibility.

**Results:**
- 136 total features (58 no-go, 78 conditional)
- Coverage: Sorowako ✓, Pomalaa ✓, Konawe ✓, Tapunopaka ✓, Obi Island ✓ (10), Weda Bay ✓ (4)
- Zero features: Morowali, Gag Island (API returns none — defaults to APL/allowed)
- No `allowed` status polygons (BIG Satupeta only returns designated forest areas; absence = allowed)

**What changed:**
- `backend/scripts/fetch_forestry_data.py` — refactored: Sulawesi belt tiled scan + point sites + centroid post-filter + Windows encoding fix
- `data/forestry_boundaries.geojson` — replaced (122 → 136 features, full belt coverage)

**What should happen next:**
- [ ] Consider converting heuristic to a lightweight decision tree trained on real data
- [ ] Add 13-exemption metadata flag for users with grandfathered CoW access to no-go zones

---

### 2026-07-09 — Removed centroid post-filter, tagged belt_scan features, re-run with fixes

**What happened:**
The centroid post-filter was discarding valid belt-edge polygons (polygons whose centroid fell slightly outside the simplified belt polygon but whose actual area was within the belt). Removing it increased coverage from 136 → 162 features. Belt_scan features now get tagged with the nearest known site name via `_tag_belt_features()` (centroid proximity check against 0.15° site bounding boxes), so per-site metadata is preserved through dedup instead of being lost.

**Results after re-run:**
- **162 features** (74 no-go, 88 conditional) — up from 136
- **Dedup**: 0 duplicate objectids ✓
- **Coverage**: pomalaa:5, sorowako:4, weda_bay:4, obi_island:10, tapunopaka:1, sulawesi_belt:138 (generic catch-all for features far from any named site)
- **Source**: 148 belt_scan + 14 point_site
- **Zeros** (API returned nothing → APL/allowed): Morowali, Gag Island, Konawe (no dedicated point_site features beyond belt_scan)
- **legal_status correctness**: 0 errors ✓
- **Unknown fungsitap codes**: `500300` (1 feature, treated as `conditional` via fallback — needs research)
- **Missing property check**: site/legal_status/tile_source/objectid/fungsitap — ALL present on every feature ✓
- **1 timeout error** on tile (120.70,-2.50-121.00,-2.20) — retryable, minor gap

**Fixes applied:**
- `100230` (HL variant) was missing from `FUNGSITAP_MAP` — was falling through to `conditional` instead of `no-go`. Fixed in script and patched in output.
- `500300` remains unmapped — treated as `conditional` (conservative default); needs research on what this BIG Satupeta code designates.

**What changed:**
- `backend/scripts/fetch_forestry_data.py` — removed centroid post-filter; added `_tag_belt_features()` for site tagging on belt_scan features; added `100230` to FUNGSITAP_MAP
- `data/forestry_boundaries.geojson` — re-run (162 features, 74/88 split)

**What should happen next:**
- [ ] Research fungsitap code `500300` — what classification does it represent?
- [ ] Add `500300` to FUNGSITAP_MAP once classified

---

### 2026-07-09 — Fixed Morowali/Konawe site coordinates pointing to regency capitals, not mining areas

**What happened:**
Morowali and Konawe coordinates were placed at administrative towns (Bungku and Unaaha) 27–34 km away from actual nickel industrial sites. This caused TARGET-mode grid generation to miss forestry boundaries captured by the belt scan.

**Coordinates corrected:**
- **Morowali**: (121.93, -2.68) → **(122.16, -2.83)** — IMIP, Bahodopi (per Wikipedia)
- **Konawe**: (122.11, -3.83) → **(122.42, -3.91)** — Morosi industrial estate, VDNI/OSS (per Global Energy Monitor)

Names updated: `"Morowali (Bungku)"` → `"Morowali (IMIP)"`, `"Konawe"` → `"Konawe (Morosi)"`

**What changed:**
- `js/shared-sites.js` — coordinates + display names
- `backend/scripts/fetch_forestry_data.py` — coordinates in SITES list

**What should happen next:**
- [ ] Research fungsitap code `500300`

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


---

### 2026-07-11 – 3D Terrain View Overhaul: Plotly → Three.js, encoding fix, UI polish

**What happened:**
The `terrain-analysis.html` page had a 3D terrain view originally rendered with Plotly.js using a 20×20 elevation grid from the Open-Elevation API. It looked blocky ("like Minecraft"), could not rotate freely (camera was stuck in Plotly's turntable mode), had widespread UTF-8 encoding corruption throughout the JS file, and had various UI/UX bugs.

**Changes:**

1. **Switched from Plotly.js surface to Three.js** (`js/terrain-analysis.js`):
   - Replaced Plotly surface trace with Three.js (WebGL, MeshStandardMaterial, PBR lighting, OrbitControls)
   - Added bilinear interpolation (scale 5, 20×20 → 100×100) to eliminate blocky appearance
   - Added real lat/lon coordinates to surface so aspect ratio matches geography
   - Dynamic aspect ratio with 3× vertical exaggeration for natural-looking slopes
   - Natural lighting: AmbientLight (0.6) + DirectionalLight (0.7) at angle + custom PBR material (roughness 0.85, metalness 0.1)
   - Reduced fog density (FogExp2 0.006 → 0.0015) to avoid darkening when zooming out

2. **3D interaction & UX** (`js/terrain-analysis.js`):
   - Moved Plotly `dragmode: 'orbit'` inside the `scene` block (was defaulting to `'turntable'`)
   - Added `uirevision: true` to preserve camera state across redraws
   - Added Three.js OrbitControls with damping, maxDistance cap (250), maxPolarAngle to prevent underground clipping
   - Added XYZ cartesian axis lines (ground grid, X/Z solid ruler lines, Y dashed elevation line)
   - Added CSS2D axis labels with real-world units (km on X/Z, meters on Y)
   - Added metric info overlay: terrain dimensions (km × km), elevation range (min–max m), center coordinates

3. **Bug fixes** (`js/terrain-analysis.js`, `terrain-analysis.html`):
   - **Loading spinner persistence**: explicit `innerHTML = ''` on render + stale-grid race guard (`currentGrid.cells === cells`) + 10s AbortController timeout on elevation API
   - **UTF-8 encoding corruption**: Replaced 20+ mojibake instances (em dashes, checkmarks ✅, arrows, etc.)
   - **Placeholder `?` icons**: `?? Select Area` → `◈ Select Area`, verdict icons → `◆`/`◈`/`◇`, expand/collapse `?` → `▲`/`▾`
   - **Undefined `--font-ui`** CSS variable added to `:root` in `css/style.css` (was causing serif fallback across all tab buttons)
   - **Google Fonts subset** updated to `latin,latin-ext` in `terrain-analysis.html`

4. **UI polish** (`terrain-analysis.html`, `css/style.css`):
   - Active tab color changed from mint green (`--accent-emerald`) to black text on light background
   - Lighting values tuned: ambient 0.55, specular 0.05, roughness 0.85
   - Added `--font-ui` variable in `css/style.css` `:root`

**What changed:**
- `js/terrain-analysis.js` — primary file (~1160 lines): all 3D rendering, labels, lines, metric overlay, encoding fixes
- `terrain-analysis.html` — CSS2DRenderer CDN, tab button CSS, Google Fonts URL, icon replacements (`??` → `◈`/`✕`)
- `css/style.css` — added `--font-ui` CSS variable in `:root`

**Dependencies added (CDN, no npm):**
- `three.min.js` r128 (WebGL renderer)
- `OrbitControls.js` r128 (camera orbit)
- `CSS2DRenderer.js` r128 (CSS2D labels on 3D scene)

**What should happen next:**
- [ ] User tests OrbitControls interaction (rotate, pan, zoom) on various terrain sizes
- [ ] Verify elevation API edge cases (ocean grids, single-cell AOIs)
- [ ] Consider wireframe overlay toggle for terrain mesh inspection
- [ ] Add elevation-profile cross-section tool along user-drawn line

---

### 2026-07-11 – 3D terrain bugfix pass: heightScale, DEM source, cleanup, flat-terrain race condition

**What happened:**
User reported the 3D terrain returned flat surfaces in multiple scenarios. An audit found 8 bugs in the 3D terrain pipeline plus a duplicate-listener race condition in `resetToBrowse()`.

**Changes:**

1. **`heightScale` always 3.0** (`js/terrain-analysis.js:528`):
   - Old: `3 / elevRange * (elevMax - elevMin)` — `elevRange` cancels out, always 3
   - New: `3.0 / elevRange` — correct vertical exaggeration proportional to actual elevation range
   - Impact: Every area looked identical regardless of whether it had 50m relief or 1000m

2. **Replaced open-elevation.com with AWS Terrarium tiles** (`js/terrain-analysis.js:635-732`):
   - Old: `api.open-elevation.com` (unreliable, rate-limited, often fails) + sine-wave synthetic fallback (`Math.sin(t * 10 + lat * 0.1)`)
   - New: AWS Open Data Terrarium tiles at `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` — free, no API key, globally available PNGs with RGB-encoded elevation
   - Decodes elevation from RGB: `(R * 256 + G + B / 256) - 32768`
   - Adaptive zoom selection (targeting ~256px across the AOI), auto-caps tile count to ≤16 by lowering zoom
   - Groups cells by tile for batch fetch, handles errors gracefully

3. **Fixed bilinear interpolation axis swap** (`js/terrain-analysis.js:618-633`):
   - `elevData` stored as `[lat][lon]` but `bilinearInterpolate` indexed as `data[lon][lat]`
   - Renamed params `(x, y)` → `(xFrac, yFrac)`, corrected to `data[iy][ix]` with `nLat`/`nLon`
   - Produced subtly wrong elevation values; on non-square bboxes would be visibly incorrect

4. **`Math.round` → `Math.floor` for vertex→cell mapping** (`js/terrain-analysis.js:540-541`):
   - `Math.round(u * (NX - 1))` works by coincidence with 20×20 — fails with any other grid size
   - New: `Math.min(NX - 1, Math.floor(u * NX))` — robust regardless of segment count

5. **Three.js WebGL memory leak** (`js/terrain-analysis.js:429-435, 614-620`):
   - No cleanup on tab switch — created new renderer/scene without disposing old one
   - Added tracking of `_3dAnimFrame`, `_3dResizeObserver`, `_3dCleanups` array
   - On each call: cancels previous animation frame, disconnects ResizeObserver, runs all cleanup funcs (renderer.dispose, etc.), then creates fresh objects
   - Also cleans up on `beforeunload` to prevent leak on page leave

6. **Ground plane & grid helper hardcoded to 20×20** (`js/terrain-analysis.js:575-587`):
   - Ground plane `20×20`, grid helper `20×10` divisions — didn't match actual terrain size (`2*aspect*8` wide)
   - Now sized dynamically: ground is `terrainSize * 1.2`, grid helper is `Math.max(w, d)` with matching divisions

7. **NX/NY hardcoded to 20** (`js/terrain-analysis.js:478-482`):
   - Derived from unique `latC` values in cells array instead — adapts to any grid dimensions

8. **Unused CSS2DRenderer import** (`terrain-analysis.html:495`):
   - Removed dead CDN script tag

9. **`lonRad` in Mercator Y formula → flat terrain bug** (`js/terrain-analysis.js:703-705`):
   - Tile pixel-Y formula used `lonRad` (longitude radians) instead of `latRad` — Mercator Y projection requires latitude
   - `Math.tan(longitude)` for Indonesia (~121°E = 2.1 rad) produces negative values → `Math.log(negative)` = `NaN` → `py = NaN` → `imgData.data[NaN]` = `undefined` → elevation = `NaN` → `finish()` sets to 0 → all cells at 0m → flat terrain every time
   - Fixed: `lonRad` → `latRad2 = cell.latC * Math.PI / 180`
   - This also fixes the always-flat problem the same day the Terrarium tiles landed (regression from earlier edit)

10. **Duplicate `CREATED` listeners from `resetToBrowse()`** (`js/terrain-analysis.js:242-250`):
    - `resetToBrowse()` called `setupDrawControl()`, which re-registers `map.on(L.Draw.Event.CREATED, ...)` — every Clear click adds a duplicate
    - After 1 Clear: 2 handlers fire on next draw. First handler's `currentGrid` + `fetchElevationData` gets overwritten by second handler's different grid (no elevation) → flat on every draw after Clear
    - Fixed: replaced `setupDrawControl()` call with inline draw-control creation only (no event listeners)
    - `setupDrawControl()` now only called once from `initMap()`

**What changed:**
- `js/terrain-analysis.js` — heightScale, Terrarium tiles, bilinear interpolation fix, Math.floor mapping, Three.js cleanup, dynamic ground/grid sizing, NX/NY derivation, lonRad→latRad fix, resetToBrowse draw-control refactor
- `terrain-analysis.html` — removed unused CSS2DRenderer import

**What should happen next:**
- [ ] Test Clear → redraw cycle (should now work without flat terrain)
- [ ] Verify Terrarium tiles load for various AOI sizes across Indonesia
- [ ] Check memory usage over multiple tab switches (no leak)
