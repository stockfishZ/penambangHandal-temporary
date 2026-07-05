# Progress Diary

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
