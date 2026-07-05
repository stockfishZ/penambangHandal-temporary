-- ============================================================================
-- NiTERRA PostGIS Schema Reference
-- Database: geonirisk
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- AUTHORITY TABLES (KLHK Official Data)
-- ============================================================================

-- 1. Forestry Boundaries (Authoritative KLHK Data)
-- Replace this placeholder with actual KLHK forestry boundary import
CREATE TABLE IF NOT EXISTS public.klhk_forestry_boundaries (
    gid SERIAL PRIMARY KEY,
    geom geometry(MultiPolygon, 4326),
    kawasan_hutan VARCHAR(100),
    kelas_hutan VARCHAR(50),
    luas_ha NUMERIC,
    izin_no VARCHAR(100),
    izin_type VARCHAR(50),
    source_date DATE,
    CONSTRAINT enforce_srid_forestry CHECK (ST_SRID(geom) = 4326)
);

CREATE INDEX IF NOT EXISTS klhk_forestry_boundaries_geom_idx
    ON public.klhk_forestry_boundaries USING GIST (geom);

-- 2. Legal Dictionary Matrix (Milestone 4.3)
-- Deterministic permit and legal reference lookup
-- Keys match actual kelas_hutan values from BIG API (resolve_fungsitap output):
--   'Hutan Konservasi', 'Hutan Lindung', 'Hutan Produksi', 'Hutan Produksi Terbatas',
--   'Hutan Produksi Konversi', 'Areal Penggunaan Lain', 'Kawasan Suaka Alam',
--   'Kawasan Pelestarian Alam', 'Taman Buru'
CREATE TABLE IF NOT EXISTS public.legal_dictionary (
    id SERIAL PRIMARY KEY,
    spatial_zone VARCHAR(100) NOT NULL UNIQUE,
    permit_required VARCHAR(100),
    legal_reference TEXT,
    mitigation_requirements TEXT,
    active_from DATE DEFAULT '2026-01-01',
    active_to DATE DEFAULT '9999-12-31'
);

INSERT INTO public.legal_dictionary (spatial_zone, permit_required, legal_reference, mitigation_requirements) VALUES
('Areal Penggunaan Lain', 'IUP (AMDAL/UKL-UPL)', 'UU 3/2020; PP 96/2021', 'AMDAL study or UKL-UPL submission required'),
('Hutan Produksi', 'PPKH (Persetujuan Penggunaan Kawasan Hutan)', 'PP 23/2021', 'Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at 1:1 ratio'),
('Hutan Produksi Terbatas', 'PPKH (Persetujuan Penggunaan Kawasan Hutan)', 'PP 23/2021', 'Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at 1:1 ratio'),
('Hutan Produksi Konversi', 'PPKH (Persetujuan Penggunaan Kawasan Hutan)', 'PP 23/2021', 'Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at 1:1 ratio'),
('Hutan Lindung', 'EXCLUDED', 'UU 41/1999', 'Strictly prohibited for open-pit mining. No permits issued.'),
('Hutan Konservasi', 'EXCLUDED', 'UU 5/1990', 'Strictly prohibited for all mining activities. No permits issued.'),
('Kawasan Suaka Alam', 'EXCLUDED', 'UU 5/1990', 'Strictly prohibited for all mining activities. No permits issued.'),
('Kawasan Pelestarian Alam', 'EXCLUDED', 'UU 5/1990', 'Strictly prohibited for all mining activities. No permits issued.'),
('Taman Buru', 'EXCLUDED', 'UU 41/1999', 'Strictly prohibited for open-pit mining. No permits issued.'),
('Kawasan Hutan', 'PPKH or IUP depending on sub-zone', 'PP 23/2021; UU 41/1999', 'Sub-zone determination required. Forest buffer zones apply.');

-- 3. Hydrological Features with DAS (Drainage Area System) data
-- OSM waterways enhanced with DAS (DAS = Drainage Area System in km²)
ALTER TABLE public.gis_osm_waterways_free_1 
ADD COLUMN IF NOT EXISTS das_km2 NUMERIC DEFAULT NULL;

-- 4. Settlements with population data for buffer determination
ALTER TABLE public.gis_osm_buildings_a_free_1
ADD COLUMN IF NOT EXISTS population INTEGER DEFAULT NULL;

-- 5. Grandfathered Concessions (Keterlanjuran — Temporal Logic / Milestone 4.3)
-- Pre-2026 legacy mining concessions exempt from new viability scoring.
-- Intersecting grids are flagged as historical anomalies, not viable targets.
-- 
-- ⚠️ DATA: Synthetic demo rows can be seeded via backend/scripts/seed_grandfathered.py.
-- Replace with real IUP/WIUP geometry from ESDM One Map before production.
-- Sources for real concession geometry:
--   (a) ESDM One Map Portal — IUP/WIUP polygon boundaries
--   (b) KLHK Tata Ruang — existing mining use permits (izin pinjam pakai)
--   (c) Manual digitization of known legacy concessions (e.g., PT Inco/Vale Sorowako,
--       PT Antam Pomalaa pre-2026 blocks)
--   (d) Seed script: backend/scripts/seed_grandfathered.py (SYNTHETIC DEMO — use --clear to reset)
CREATE TABLE IF NOT EXISTS public.grandfathered_concessions (
    gid SERIAL PRIMARY KEY,
    geom geometry(MultiPolygon, 4326),
    concession_name VARCHAR(200),
    company_name VARCHAR(200),
    izin_no VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Keterlanjuran',
    source_date DATE,
    notes TEXT,
    CONSTRAINT enforce_srid_grandfathered CHECK (ST_SRID(geom) = 4326)
);

CREATE INDEX IF NOT EXISTS grandfathered_concessions_geom_idx
    ON public.grandfathered_concessions USING GIST (geom);

-- ============================================================================
-- EXISTING OSM TABLES (geonirisk live data)
-- ============================================================================

-- The live geonirisk database uses an OSM/PostGIS import, not the old synthetic
-- Phase 1 table names. Backend spatial queries should target these tables:
--
-- public.gis_osm_roads_free_1
--   geom: geometry(MultiLineString, 4326)
--   useful columns: gid, osm_id, fclass, name, ref, oneway, maxspeed
--
-- public.gis_osm_waterways_free_1
--   geom: geometry(MultiLineString, 4326)
--   useful columns: gid, osm_id, fclass, width, name, das_km2
--
-- public.gis_osm_water_a_free_1
--   geom: geometry(MultiPolygon, 4326)
--   useful columns: gid, osm_id, fclass, name
--
-- public.gis_osm_buildings_a_free_1
--   geom: geometry(MultiPolygon, 4326)
--   useful columns: gid, osm_id, fclass, name, type, population
--
-- public.gis_osm_pois_free_1
--   geom: geometry(Point); most rows have SRID 4326, some rows are SRID 0.
--   Backend queries normalize this with ST_SetSRID(geom, 4326).
--   useful columns: gid, osm_id, fclass, name
--
-- public.gis_osm_landuse_a_free_1
--   geom: geometry(MultiPolygon, 4326)
--   useful columns: gid, osm_id, fclass, name
--
-- Existing GiST indexes expected by the backend:
CREATE INDEX IF NOT EXISTS gis_osm_roads_free_1_geom_idx
    ON public.gis_osm_roads_free_1 USING GIST (geom);

CREATE INDEX IF NOT EXISTS gis_osm_waterways_free_1_geom_idx
    ON public.gis_osm_waterways_free_1 USING GIST (geom);

CREATE INDEX IF NOT EXISTS gis_osm_water_a_free_1_geom_idx
    ON public.gis_osm_water_a_free_1 USING GIST (geom);

CREATE INDEX IF NOT EXISTS gis_osm_buildings_a_free_1_geom_idx
    ON public.gis_osm_buildings_a_free_1 USING GIST (geom);

CREATE INDEX IF NOT EXISTS gis_osm_pois_free_1_geom_idx
    ON public.gis_osm_pois_free_1 USING GIST (geom);

CREATE INDEX IF NOT EXISTS gis_osm_landuse_a_free_1_geom_idx
    ON public.gis_osm_landuse_a_free_1 USING GIST (geom);

-- ============================================================================
-- COMPLIANCE NOTES
-- ============================================================================

-- 1. Forestry Boundaries: Replace klhk_forestry_boundaries data with official
--    KLHK GIS export (shapefile/GeoJSON). Current OSM landuse is PROXY ONLY.
--
-- 2. Legal Dictionary: Table populated with 2026 regulations. Update active_from/
--    active_to dates when regulations change.
--
-- 3. Distance Projection: All spatial calculations use ST_Transform to the
--    appropriate UTM zone (see get_utm_srid() in queries.sql) for meter-based
--    distances. Ensure input coordinates are EPSG:4326 (WGS84).
--
-- 4. Kill Zones: Hutan Konservasi and Hutan Lindung are HARD 0 exclusion zones
--    under UU 41/1999 and UU 5/1990. No mitigation possible.
--
-- 5. Hydrological Buffers: Milestone 3.2 requires different buffer rules for
--    Kawasan Hutan vs APL. See queries.sql for implementation.
--
-- 6. Temporal Logic (Keterlanjuran): Grandfathered concessions intersecting a
--    grid point flag it as a historical anomaly. Viability is set to 0 and the
--    legal response appends the grandfathered status. ML must not score these
--    as viable targets under current 2026 regulations.
--    ⚠️ Run backend/scripts/seed_grandfathered.py to populate with synthetic demo data.
--
-- 7. Hard 0 Penalty Zone (Permen LH 4/2012): Distance < 500m from settlements,
--    public roads, or public facilities sets viability_score to 0.0. The
--    kajian_teknis_kestabilan flag may mitigate the settlement buffer only.
