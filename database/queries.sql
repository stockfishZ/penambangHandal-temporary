-- ============================================================================
-- SQL Queries & Functions for Spatial Feature Extraction & Compliance Engine
-- File: database/queries.sql
-- ============================================================================

-- ============================================================================
-- MILESTONE 3.2: DYNAMIC HYDROLOGICAL BUFFERS
-- ============================================================================
-- Kawasan Hutan (Forest Zone): 100m rivers, 50m tributaries, 200m springs, 500m lakes, 2x depth ravines
-- APL (Non-Forest): 100m rivers DAS > 500km², 50m rivers DAS <= 500km² (Permen PUPR 28/2015)
-- ============================================================================

-- 1. Helper function: Determine if point is inside Kawasan Hutan
CREATE OR REPLACE FUNCTION public.is_kawasan_hutan(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE
    tp_geom GEOMETRY(Point, 4326);
    result BOOLEAN;
BEGIN
    tp_geom := ST_SetSRID(ST_Point(lon, lat), 4326);
    
    SELECT EXISTS (
        SELECT 1 FROM public.klhk_forestry_boundaries f
        WHERE ST_Intersects(f.geom, tp_geom)
        AND f.kawasan_hutan IS NOT NULL
    ) INTO result;
    
    RETURN COALESCE(result, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Helper function: Get hydrological buffer distance based on zone and feature type
CREATE OR REPLACE FUNCTION public.get_hydro_buffer_distance(
    feature_type VARCHAR,
    das_km2 DOUBLE PRECISION,
    is_forest BOOLEAN
) RETURNS INTEGER AS $$
BEGIN
    IF is_forest THEN
        CASE feature_type
            WHEN 'river' THEN RETURN 100;
            WHEN 'tributary' THEN RETURN 50;
            WHEN 'spring' THEN RETURN 200;
            WHEN 'lake' THEN RETURN 500;
            WHEN 'ravine' THEN RETURN 200; 
            ELSE RETURN 0;
        END CASE;
    ELSE
        IF das_km2 > 500 THEN
            RETURN 100;
        ELSE
            RETURN 50;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2b. OSM fclass to hydro category mapper
-- Real OSM waterways use: river, stream, drain, canal
-- Real OSM water areas use: water, reservoir, riverbank, wetland*, dock, glacier
-- This maps them to categories that get_hydro_buffer_distance() understands.
CREATE OR REPLACE FUNCTION public.osm_fclass_to_hydro_category(osm_fclass VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    CASE osm_fclass
        WHEN 'river' THEN RETURN 'river';
        WHEN 'stream' THEN RETURN 'tributary';
        WHEN 'drain' THEN RETURN 'tributary';
        WHEN 'canal' THEN RETURN 'tributary';
        WHEN 'water' THEN RETURN 'lake';
        WHEN 'reservoir' THEN RETURN 'lake';
        WHEN 'riverbank' THEN RETURN 'lake';
        WHEN 'dock' THEN RETURN 'lake';
        WHEN 'glacier' THEN RETURN 'lake';
        WHEN 'wetland' THEN RETURN 'lake';
        WHEN 'wetland_mangrove' THEN RETURN 'lake';
        WHEN 'wetland_marsh' THEN RETURN 'lake';
        WHEN 'wetland_swamp' THEN RETURN 'lake';
        WHEN 'wetland_wet_meadow' THEN RETURN 'lake';
        WHEN 'wetland_tidalflat' THEN RETURN 'lake';
        WHEN 'wetland_bog' THEN RETURN 'lake';
        WHEN 'wetland_reedbed' THEN RETURN 'lake';
        WHEN 'wetland_saltmarsh' THEN RETURN 'lake';
        WHEN 'wetland_fen' THEN RETURN 'lake';
        ELSE RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Helper function: Check if point is inside kill zone (Hutan Konservasi or Hutan Lindung)
CREATE OR REPLACE FUNCTION public.is_kill_zone(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE
    tp_geom GEOMETRY(Point, 4326);
    result BOOLEAN;
BEGIN
    tp_geom := ST_SetSRID(ST_Point(lon, lat), 4326);
    
    SELECT EXISTS (
        SELECT 1 FROM public.klhk_forestry_boundaries f
        WHERE ST_Intersects(f.geom, tp_geom)
        AND f.kelas_hutan IN ('Hutan Konservasi', 'Hutan Lindung')
    ) INTO result;
    
    RETURN COALESCE(result, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Helper function: Get legal dictionary lookup
CREATE OR REPLACE FUNCTION public.get_legal_dictionary_entry(land_classification VARCHAR)
RETURNS TABLE (
    spatial_zone VARCHAR,
    permit_required VARCHAR,
    legal_reference TEXT,
    mitigation_requirements TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ld.spatial_zone, ld.permit_required, ld.legal_reference, ld.mitigation_requirements
    FROM public.legal_dictionary ld
    WHERE ld.spatial_zone = land_classification
    AND CURRENT_DATE BETWEEN ld.active_from AND ld.active_to;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Helper function: Determine UTM SRID for a given lon/lat
-- Used to satisfy Architect Note 2 (metric projection for distance calcs)
CREATE OR REPLACE FUNCTION public.get_utm_srid(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS INTEGER AS $$
DECLARE
    zone INTEGER;
BEGIN
    zone := floor((lon + 180) / 6)::INTEGER % 60 + 1;
    IF zone < 46 OR zone > 54 THEN
        zone := LEAST(GREATEST(zone, 46), 54);
    END IF;
    IF lat >= 0 THEN
        RETURN 32600 + zone;
    ELSE
        RETURN 32700 + zone;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Helper function: Check if point is inside a grandfathered concession
-- Implements Milestone 4.3 Temporal Logic (Keterlanjuran)
CREATE OR REPLACE FUNCTION public.is_grandfathered(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE
    tp_geom GEOMETRY(Point, 4326);
    result BOOLEAN;
BEGIN
    tp_geom := ST_SetSRID(ST_Point(lon, lat), 4326);
    SELECT EXISTS (
        SELECT 1 FROM public.grandfathered_concessions g
        WHERE ST_Intersects(g.geom, tp_geom)
    ) INTO result;
    RETURN COALESCE(result, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- MILESTONE 3.3 & 4.3: KILL ZONES & LEGAL DICTIONARY
-- ============================================================================
-- Kill Zone (Hard 0): Hutan Konservasi, Hutan Lindung, Forest hydro buffers
-- Legal Dictionary: Deterministic permit lookup based on spatial zone
-- ============================================================================

-- 1. Unified CTE Query for the live geonirisk database.
-- Replace :lon and :lat placeholders with the target coordinates (EPSG:4326).
WITH 
target_point AS (
    SELECT ST_SetSRID(ST_Point(:lon, :lat), 4326) AS geom
),
is_forest AS (
    SELECT public.is_kawasan_hutan(:lon, :lat) AS is_kawasan_hutan
),
kill_zone_check AS (
    SELECT public.is_kill_zone(:lon, :lat) AS is_kill_zone
),
nearest_road AS (
    SELECT 
        r.name,
        r.fclass AS road_type,
        ST_Distance(r.geom::geography, tp.geom::geography) AS distance_meters
    FROM gis_osm_roads_free_1 r, target_point tp
    ORDER BY r.geom <-> tp.geom
    LIMIT 1
),
nearest_waterway AS (
    SELECT
        w.name,
        w.fclass AS water_type,
        COALESCE(w.das_km2, 0) AS das_km2,
        ST_Distance(w.geom::geography, tp.geom::geography) AS distance_meters
    FROM gis_osm_waterways_free_1 w, target_point tp
    ORDER BY w.geom <-> tp.geom
    LIMIT 1
),
nearest_water_area AS (
        SELECT
            w.name,
            w.fclass AS water_type,
            0.0::DOUBLE PRECISION AS das_km2,
            ST_Distance(w.geom::geography, tp.geom::geography) AS distance_meters
        FROM gis_osm_water_a_free_1 w, target_point tp
        ORDER BY w.geom <-> tp.geom
        LIMIT 1
    ),
    nearest_water AS (
        SELECT * FROM nearest_waterway
        UNION ALL
        SELECT * FROM nearest_water_area
        ORDER BY distance_meters
        LIMIT 1
    ),
    nearest_settlement AS (
    SELECT
        b.name,
        COALESCE(b.type, b.fclass) AS settlement_type,
        COALESCE(b.population, 0) AS population,
        ST_Distance(b.geom::geography, tp.geom::geography) AS distance_meters
    FROM gis_osm_buildings_a_free_1 b, target_point tp
    ORDER BY b.geom <-> tp.geom
    LIMIT 1
),
nearest_smelter AS (
    SELECT source, name, site_type, distance_meters
    FROM (
        SELECT 'poi' AS source, p.name, p.fclass AS site_type,
            ST_Distance(ST_SetSRID(p.geom, 4326)::geography, tp.geom::geography) AS distance_meters
        FROM gis_osm_pois_free_1 p, target_point tp
        WHERE p.name ILIKE ANY(ARRAY['%smelter%', '%pengolahan%', '%pemurnian%', '%nikel%'])
        ORDER BY ST_SetSRID(p.geom, 4326) <-> tp.geom
        LIMIT 10
    ) poi_candidates
    UNION ALL
    SELECT source, name, site_type, distance_meters
    FROM (
        SELECT 'landuse' AS source, l.name, l.fclass AS site_type,
            ST_Distance(l.geom::geography, tp.geom::geography) AS distance_meters
        FROM gis_osm_landuse_a_free_1 l, target_point tp
        WHERE l.name ILIKE ANY(ARRAY['%smelter%', '%pengolahan%', '%pemurnian%', '%nikel%'])
        ORDER BY l.geom <-> tp.geom
        LIMIT 10
    ) landuse_candidates
    ORDER BY distance_meters
    LIMIT 1
),
landuse_at_point AS (
    SELECT l.fclass AS landuse_class, l.name AS landuse_name
    FROM gis_osm_landuse_a_free_1 l, target_point tp
    WHERE ST_Intersects(l.geom, tp.geom)
    ORDER BY ST_Area(l.geom::geography) ASC
    LIMIT 1
),
forestry_at_point AS (
    SELECT 
        f.kawasan_hutan,
        f.kelas_hutan,
        f.izin_no,
        f.izin_type
    FROM public.klhk_forestry_boundaries f, target_point tp
    WHERE ST_Intersects(f.geom, tp.geom)
    ORDER BY ST_Area(f.geom::geography) ASC
    LIMIT 1
),
legal_lookup AS (
    SELECT * FROM public.get_legal_dictionary_entry(
        COALESCE(
            (SELECT fap.kelas_hutan FROM forestry_at_point fap),
            (SELECT landuse_class FROM landuse_at_point),
            'Areal Penggunaan Lain'
        )
    )
),
nearest_public_facility AS (
    SELECT
        p.name,
        p.fclass AS facility_type,
        ST_Distance(ST_SetSRID(p.geom, 4326)::geography, tp.geom::geography) AS distance_meters
    FROM gis_osm_pois_free_1 p, target_point tp
    WHERE p.fclass IN (
        'school', 'university', 'kindergarten', 'college',
        'hospital', 'clinic', 'doctors', 'pharmacy',
        'town_hall', 'public_building', 'police', 'fire_station',
        'place_of_worship', 'mosque', 'church', 'temple',
        'marketplace', 'supermarket', 'mall',
        'library', 'post_office', 'bank', 'community_centre'
    )
    ORDER BY ST_SetSRID(p.geom, 4326) <-> tp.geom
    LIMIT 1
),
grandfathered_check AS (
    SELECT public.is_grandfathered(:lon, :lat) AS is_grandfathered
)
SELECT 
    :lon AS longitude,
    :lat AS latitude,
    kill_zone_check.is_kill_zone,
    grandfathered_check.is_grandfathered,
    CASE 
        WHEN kill_zone_check.is_kill_zone THEN TRUE
        WHEN grandfathered_check.is_grandfathered THEN TRUE
        WHEN (SELECT fap.kawasan_hutan FROM forestry_at_point fap) IS NOT NULL AND (SELECT fap.kelas_hutan FROM forestry_at_point fap) IN ('Hutan Lindung', 'Hutan Konservasi') THEN TRUE
        ELSE FALSE
    END AS kill_zone_exclusion,
    COALESCE((SELECT distance_meters FROM nearest_road), 0.0) AS dist_to_road_meters,
    COALESCE((SELECT road_type FROM nearest_road), 'none') AS nearest_road_type,
    COALESCE((SELECT name FROM nearest_road), 'none') AS nearest_road_name,
    COALESCE((SELECT distance_meters FROM nearest_water), 0.0) AS dist_to_water_meters,
    COALESCE((SELECT water_type FROM nearest_water), 'none') AS nearest_water_type,
    COALESCE((SELECT name FROM nearest_water), 'none') AS nearest_water_name,
    COALESCE((SELECT das_km2 FROM nearest_water), 0.0) AS water_das_km2,
    COALESCE((SELECT distance_meters FROM nearest_settlement), 0.0) AS dist_to_settlement_meters,
    COALESCE((SELECT settlement_type FROM nearest_settlement), 'none') AS nearest_settlement_type,
    COALESCE((SELECT name FROM nearest_settlement), 'none') AS nearest_settlement_name,
    COALESCE((SELECT population FROM nearest_settlement), 0) AS settlement_population,
    COALESCE((SELECT distance_meters FROM nearest_smelter), 0.0) AS dist_to_smelter_meters,
    COALESCE((SELECT name FROM nearest_smelter), 'none') AS nearest_smelter_name,
    COALESCE((SELECT site_type FROM nearest_smelter), 'none') AS nearest_smelter_type,
    COALESCE((SELECT source FROM nearest_smelter), 'none') AS nearest_smelter_source,
    COALESCE((SELECT distance_meters FROM nearest_public_facility), 0.0) AS dist_to_public_facility_meters,
    COALESCE((SELECT facility_type FROM nearest_public_facility), 'none') AS nearest_facility_type,
    COALESCE((SELECT name FROM nearest_public_facility), 'none') AS nearest_facility_name,
    COALESCE((SELECT landuse_class FROM landuse_at_point), 'unknown') AS land_classification,
    COALESCE((SELECT landuse_name FROM landuse_at_point), 'none') AS landuse_name,
    COALESCE((SELECT fap.kawasan_hutan FROM forestry_at_point fap), 'none') AS kawasan_hutan,
    COALESCE((SELECT fap.kelas_hutan FROM forestry_at_point fap), 'none') AS kelas_hutan,
    COALESCE((SELECT izin_no FROM forestry_at_point), 'none') AS izin_no,
    COALESCE((SELECT izin_type FROM forestry_at_point), 'none') AS izin_type,
    COALESCE((SELECT spatial_zone FROM legal_lookup), 'unknown') AS legal_zone,
    COALESCE((SELECT permit_required FROM legal_lookup), 'unknown') AS permit_required,
    COALESCE((SELECT legal_reference FROM legal_lookup), 'UU 3/2020; PP 96/2021') AS legal_reference,
    COALESCE((SELECT mitigation_requirements FROM legal_lookup), 'Verify permits with local authorities') AS mitigation_requirements,
    CASE COALESCE((SELECT landuse_class FROM landuse_at_point), 'unknown')
        WHEN 'forest' THEN 'OSM landuse forest proxy. Verify against official KLHK forestry boundaries before legal decisions.'
        WHEN 'quarry' THEN 'OSM quarry/mining proxy. Verify IUP and official spatial permits before legal decisions.'
        WHEN 'residential' THEN 'OSM residential landuse proxy. Mining activity requires exclusion/buffer review and local permitting verification.'
        WHEN 'industrial' THEN 'OSM industrial landuse proxy. Verify zoning, AMDAL, IUP, and other applicable permits.'
        WHEN 'unknown' THEN 'No intersecting OSM landuse polygon in geonirisk. Authoritative KLHK/land-rights overlay is still required.'
        ELSE 'OSM landuse proxy only. Authoritative KLHK/land-rights overlay is still required before legal decisions.'
    END AS governing_laws,
    CASE 
        WHEN kill_zone_check.is_kill_zone THEN 'KILL ZONE: Hutan Konservasi or Hutan Lindung. Mining prohibited.'
        WHEN grandfathered_check.is_grandfathered THEN 'HISTORICAL ANOMALY: Grandfathered concession (Keterlanjuran). Not viable under 2026 regulations.'
        WHEN (SELECT fap.kawasan_hutan FROM forestry_at_point fap) IS NOT NULL AND (SELECT fap.kelas_hutan FROM forestry_at_point fap) IN ('Hutan Lindung', 'Hutan Konservasi') THEN 'KILL ZONE: Official KLHK forestry boundary. Mining prohibited.'
        WHEN (SELECT fap.kawasan_hutan FROM forestry_at_point fap) IS NOT NULL THEN 'Kawasan Hutan: Verify sub-zone and obtain PPKH if applicable.'
        ELSE 'Non-forestry area: Verify land use classification and applicable permits.'
    END AS compliance_status;


-- ============================================================================
-- 2. Stored PL/pgSQL function for easy backend execution against geonirisk.
-- ============================================================================
-- This function encapsulates all Milestone 3.2 and 4.3 logic for backend use.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_grid_spatial_features(lon DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS TABLE (
    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    is_kill_zone BOOLEAN,
    kill_zone_exclusion BOOLEAN,
    dist_to_road_meters DOUBLE PRECISION,
    nearest_road_type VARCHAR,
    nearest_road_name VARCHAR,
    dist_to_water_meters DOUBLE PRECISION,
    nearest_water_type VARCHAR,
    nearest_water_name VARCHAR,
    water_das_km2 DOUBLE PRECISION,
    dist_to_settlement_meters DOUBLE PRECISION,
    nearest_settlement_type VARCHAR,
    nearest_settlement_name VARCHAR,
    settlement_population INTEGER,
    dist_to_smelter_meters DOUBLE PRECISION,
    nearest_smelter_name VARCHAR,
    nearest_smelter_type VARCHAR,
    nearest_smelter_source TEXT,
    dist_to_public_facility_meters DOUBLE PRECISION,
    nearest_facility_type VARCHAR,
    nearest_facility_name VARCHAR,
    land_classification VARCHAR,
    landuse_name VARCHAR,
    kawasan_hutan VARCHAR,
    kelas_hutan VARCHAR,
    izin_no VARCHAR,
    izin_type VARCHAR,
    legal_zone VARCHAR,
    permit_required VARCHAR,
    legal_reference TEXT,
    mitigation_requirements TEXT,
    within_hydro_buffer BOOLEAN,
    within_apl_hydro_buffer BOOLEAN,
    is_grandfathered BOOLEAN,
    governing_laws TEXT,
    compliance_status TEXT
) AS $$
DECLARE
    tp_geom GEOMETRY(Point, 4326);
    utm_srid INTEGER;
    is_kh BOOLEAN;
    kz BOOLEAN;
    gf BOOLEAN;
BEGIN
    tp_geom := ST_SetSRID(ST_Point(lon, lat), 4326);
    utm_srid := public.get_utm_srid(lon, lat);
    is_kh := public.is_kawasan_hutan(lon, lat);
    kz := public.is_kill_zone(lon, lat);
    gf := public.is_grandfathered(lon, lat);

    RETURN QUERY
    WITH 
    target_point AS (
        SELECT tp_geom AS geom
    ),
    nearest_road AS (
        SELECT 
            r.name,
            r.fclass AS road_type,
            ST_Distance(ST_Transform(r.geom, utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
        FROM gis_osm_roads_free_1 r
        ORDER BY r.geom <-> tp_geom
        LIMIT 1
    ),
    nearest_waterway AS (
        SELECT
            w.name,
            w.fclass AS water_type,
            COALESCE(w.das_km2, 0) AS das_km2,
            ST_Distance(ST_Transform(w.geom, utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
        FROM gis_osm_waterways_free_1 w
        ORDER BY w.geom <-> tp_geom
        LIMIT 1
    ),
    nearest_water_area AS (
        SELECT
            w.name,
            w.fclass AS water_type,
            0.0::DOUBLE PRECISION AS das_km2,
            ST_Distance(ST_Transform(w.geom, utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
        FROM gis_osm_water_a_free_1 w
        ORDER BY w.geom <-> tp_geom
        LIMIT 1
    ),
    nearest_water AS (
        SELECT * FROM nearest_waterway
        UNION ALL
        SELECT * FROM nearest_water_area
        ORDER BY distance_meters
        LIMIT 1
    ),
    nearest_settlement AS (
        SELECT
            b.name,
            COALESCE(b.type, b.fclass) AS settlement_type,
            COALESCE(b.population, 0) AS population,
            ST_Distance(ST_Transform(b.geom, utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
        FROM gis_osm_buildings_a_free_1 b
        ORDER BY b.geom <-> tp_geom
        LIMIT 1
    ),
    nearest_public_facility AS (
        SELECT
            p.name,
            p.fclass AS facility_type,
            ST_Distance(ST_Transform(ST_SetSRID(p.geom, 4326), utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
        FROM gis_osm_pois_free_1 p
        WHERE p.fclass IN (
            'school', 'university', 'kindergarten', 'college',
            'hospital', 'clinic', 'doctors', 'pharmacy',
            'town_hall', 'public_building', 'police', 'fire_station',
            'place_of_worship', 'mosque', 'church', 'temple',
            'marketplace', 'supermarket', 'mall',
            'library', 'post_office', 'bank', 'community_centre'
        )
        ORDER BY ST_SetSRID(p.geom, 4326) <-> tp_geom
        LIMIT 1
    ),
    nearest_smelter AS (
        SELECT source, name, site_type, distance_meters
        FROM (
            SELECT 'poi' AS source, p.name, p.fclass AS site_type,
                ST_Distance(ST_Transform(ST_SetSRID(p.geom, 4326), utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
            FROM gis_osm_pois_free_1 p
            WHERE p.name ILIKE ANY(ARRAY['%smelter%', '%pengolahan%', '%pemurnian%', '%nikel%'])
            ORDER BY ST_SetSRID(p.geom, 4326) <-> tp_geom
            LIMIT 10
        ) poi_candidates
        UNION ALL
        SELECT source, name, site_type, distance_meters
        FROM (
            SELECT 'landuse' AS source, l.name, l.fclass AS site_type,
                ST_Distance(ST_Transform(l.geom, utm_srid), ST_Transform(tp_geom, utm_srid)) AS distance_meters
            FROM gis_osm_landuse_a_free_1 l
            WHERE l.name ILIKE ANY(ARRAY['%smelter%', '%pengolahan%', '%pemurnian%', '%nikel%'])
            ORDER BY l.geom <-> tp_geom
            LIMIT 10
        ) landuse_candidates
        ORDER BY distance_meters
        LIMIT 1
    ),
    landuse_at_point AS (
        SELECT l.fclass AS landuse_class, l.name AS landuse_name
        FROM gis_osm_landuse_a_free_1 l
        WHERE ST_Intersects(l.geom, tp_geom)
        ORDER BY ST_Area(ST_Transform(l.geom, utm_srid)) ASC
        LIMIT 1
    ),
    forestry_at_point AS (
        SELECT 
            f.kawasan_hutan,
            f.kelas_hutan,
            f.izin_no,
            f.izin_type
        FROM public.klhk_forestry_boundaries f
        WHERE ST_Intersects(f.geom, tp_geom)
        ORDER BY ST_Area(ST_Transform(f.geom, utm_srid)) ASC
        LIMIT 1
    ),
    legal_lookup AS (
    SELECT * FROM public.get_legal_dictionary_entry(
        COALESCE(
            (SELECT fap.kelas_hutan FROM forestry_at_point fap),
            (SELECT landuse_class FROM landuse_at_point),
            'Areal Penggunaan Lain'
        )
    )
),
hydro_buffer_breach AS (
    SELECT
        CASE
            WHEN is_kh AND (
                SELECT distance_meters FROM nearest_water
            ) < public.get_hydro_buffer_distance(
                COALESCE(public.osm_fclass_to_hydro_category((SELECT water_type::VARCHAR FROM nearest_water)), ''),
                (SELECT das_km2::DOUBLE PRECISION FROM nearest_water),
                is_kh
            ) THEN TRUE
            ELSE FALSE
        END AS is_breach
),
apl_hydro_buffer_breach AS (
    SELECT
        CASE
            WHEN NOT is_kh AND (
                SELECT distance_meters FROM nearest_water
            ) < public.get_hydro_buffer_distance(
                COALESCE(public.osm_fclass_to_hydro_category((SELECT water_type::VARCHAR FROM nearest_water)), ''),
                (SELECT das_km2::DOUBLE PRECISION FROM nearest_water),
                FALSE
            ) THEN TRUE
            ELSE FALSE
        END AS is_breach
)
SELECT 
    lon AS longitude,
    lat AS latitude,
    kz AS is_kill_zone,
    CASE 
        WHEN kz THEN TRUE
        WHEN gf THEN TRUE
        WHEN (SELECT fap.kelas_hutan FROM forestry_at_point fap) IN ('Hutan Lindung', 'Hutan Konservasi') THEN TRUE
        WHEN (SELECT is_breach FROM hydro_buffer_breach) AND is_kh THEN TRUE
        ELSE FALSE
    END AS kill_zone_exclusion,
    COALESCE((SELECT distance_meters FROM nearest_road), 0.0) AS dist_to_road_meters,
    COALESCE((SELECT road_type::VARCHAR FROM nearest_road), 'none'::VARCHAR) AS nearest_road_type,
    COALESCE((SELECT name::VARCHAR FROM nearest_road), 'none'::VARCHAR) AS nearest_road_name,
    COALESCE((SELECT distance_meters FROM nearest_water), 0.0) AS dist_to_water_meters,
    COALESCE((SELECT water_type::VARCHAR FROM nearest_water), 'none'::VARCHAR) AS nearest_water_type,
    COALESCE((SELECT name::VARCHAR FROM nearest_water), 'none'::VARCHAR) AS nearest_water_name,
    COALESCE((SELECT das_km2::DOUBLE PRECISION FROM nearest_water), 0.0) AS water_das_km2,
    COALESCE((SELECT distance_meters FROM nearest_settlement), 0.0) AS dist_to_settlement_meters,
    COALESCE((SELECT settlement_type::VARCHAR FROM nearest_settlement), 'none'::VARCHAR) AS nearest_settlement_type,
    COALESCE((SELECT name::VARCHAR FROM nearest_settlement), 'none'::VARCHAR) AS nearest_settlement_name,
    COALESCE((SELECT population::INTEGER FROM nearest_settlement), 0) AS settlement_population,
    COALESCE((SELECT distance_meters FROM nearest_smelter), 0.0) AS dist_to_smelter_meters,
    COALESCE((SELECT name::VARCHAR FROM nearest_smelter), 'none'::VARCHAR) AS nearest_smelter_name,
    COALESCE((SELECT site_type::VARCHAR FROM nearest_smelter), 'none'::VARCHAR) AS nearest_smelter_type,
    COALESCE((SELECT source FROM nearest_smelter), 'none') AS nearest_smelter_source,
    COALESCE((SELECT distance_meters FROM nearest_public_facility), 0.0) AS dist_to_public_facility_meters,
    COALESCE((SELECT facility_type::VARCHAR FROM nearest_public_facility), 'none'::VARCHAR) AS nearest_facility_type,
    COALESCE((SELECT name::VARCHAR FROM nearest_public_facility), 'none'::VARCHAR) AS nearest_facility_name,
        COALESCE((SELECT landuse_class::VARCHAR FROM landuse_at_point), 'unknown'::VARCHAR) AS land_classification,
        COALESCE((SELECT lap.landuse_name::VARCHAR FROM landuse_at_point lap), 'none'::VARCHAR) AS landuse_name,
        COALESCE((SELECT fap.kawasan_hutan::VARCHAR FROM forestry_at_point fap), 'none'::VARCHAR) AS kawasan_hutan,
        COALESCE((SELECT fap.kelas_hutan::VARCHAR FROM forestry_at_point fap), 'none'::VARCHAR) AS kelas_hutan,
        COALESCE((SELECT fap.izin_no::VARCHAR FROM forestry_at_point fap), 'none'::VARCHAR) AS izin_no,
        COALESCE((SELECT fap.izin_type::VARCHAR FROM forestry_at_point fap), 'none'::VARCHAR) AS izin_type,
        COALESCE((SELECT spatial_zone::VARCHAR FROM legal_lookup), 'unknown'::VARCHAR) AS legal_zone,
        COALESCE((SELECT ll.permit_required::VARCHAR FROM legal_lookup ll), 'unknown'::VARCHAR) AS permit_required,
        COALESCE((SELECT ll.legal_reference::TEXT FROM legal_lookup ll), 'UU 3/2020; PP 96/2021'::TEXT) AS legal_reference,
        COALESCE((SELECT ll.mitigation_requirements::TEXT FROM legal_lookup ll), 'Verify permits with local authorities'::TEXT) AS mitigation_requirements,
    COALESCE((SELECT is_breach FROM hydro_buffer_breach), FALSE) AS within_hydro_buffer,
    COALESCE((SELECT is_breach FROM apl_hydro_buffer_breach), FALSE) AS within_apl_hydro_buffer,
    gf AS is_grandfathered,
    CASE COALESCE((SELECT landuse_class FROM landuse_at_point), 'unknown')
        WHEN 'forest' THEN 'OSM landuse forest proxy. Verify against official KLHK forestry boundaries before legal decisions.'
        WHEN 'quarry' THEN 'OSM quarry/mining proxy. Verify IUP and official spatial permits before legal decisions.'
        WHEN 'residential' THEN 'OSM residential landuse proxy. Mining activity requires exclusion/buffer review and local permitting verification.'
        WHEN 'industrial' THEN 'OSM industrial landuse proxy. Verify zoning, AMDAL, IUP, and other applicable permits.'
        WHEN 'unknown' THEN 'No intersecting OSM landuse polygon in geonirisk. Authoritative KLHK/land-rights overlay is still required.'
        ELSE 'OSM landuse proxy only. Authoritative KLHK/land-rights overlay is still required before legal decisions.'
    END AS governing_laws,
    CASE 
        WHEN kz THEN 'KILL ZONE: Hutan Konservasi or Hutan Lindung. Mining prohibited.'
        WHEN gf THEN 'HISTORICAL ANOMALY: Grandfathered concession (Keterlanjuran). Not viable under 2026 regulations.'
        WHEN (SELECT fap.kelas_hutan FROM forestry_at_point fap) IN ('Hutan Lindung', 'Hutan Konservasi') THEN 'KILL ZONE: Official KLHK forestry boundary. Mining prohibited.'
        WHEN (SELECT is_breach FROM hydro_buffer_breach) AND is_kh THEN 'KILL ZONE: Within hydrological buffer in Kawasan Hutan. Mining prohibited.'
        WHEN (SELECT fap.kawasan_hutan FROM forestry_at_point fap) IS NOT NULL THEN 'Kawasan Hutan: Verify sub-zone and obtain PPKH if applicable.'
        ELSE 'Non-forestry area: Verify land use classification and applicable permits.'
    END AS compliance_status;
END;
$$ LANGUAGE plpgsql STABLE;
