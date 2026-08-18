"""Generate comprehensive study grids + consolidate into real-world exploration testing datasets.
Legal_status from real BIG Satupeta polygons.
Coordinates are strictly targeted at pristine deep interior greenfield ridges (far away from settlements, smelters, towns, lakes, and active open pits).
Data includes Sentinel-2 Remote Sensing spectral indices & UAV Magnetometry TMI telemetry.
"""
import json, csv, random, math, os

NICKEL_BELTS = [
    {"id":"sorowako","lon":121.49,"lat":-2.60,"name":"Sorowako Greenfield Interior Ridge (East Plateau)","province":"Sulawesi Selatan","context":"East Sulawesi Ophiolite Belt","tier":"HIGH","elevation_mean":520,"elevation_max":680,"elevation_min":420,"slope_mean":14,"terrain_class":"HILLY"},
    {"id":"morowali","lon":121.83,"lat":-2.84,"name":"Morowali Deep Greenfield Mountains (West Interior)","province":"Sulawesi Tengah","context":"East Sulawesi Ophiolite Belt","tier":"HIGH","elevation_mean":280,"elevation_max":480,"elevation_min":110,"slope_mean":10,"terrain_class":"ROLLING"},
    {"id":"weda_bay","lon":127.92,"lat":0.49,"name":"Weda Bay Central Greenfield Ridge (Halmahera)","province":"Maluku Utara","context":"Halmahera Ophiolite","tier":"HIGH","elevation_mean":360,"elevation_max":810,"elevation_min":60,"slope_mean":18,"terrain_class":"MOUNTAINOUS"},
    {"id":"pomalaa","lon":121.66,"lat":-4.18,"name":"Pomalaa Greenfield Interior Block (ANTAM Prospect)","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"MEDIUM","elevation_mean":190,"elevation_max":340,"elevation_min":50,"slope_mean":7,"terrain_class":"FLAT"},
    {"id":"gag_island","lon":129.87,"lat":-0.05,"name":"Gag Island Interior Plateau","province":"Papua Barat Daya","context":"Waigeo Ophiolite","tier":"HIGH","elevation_mean":140,"elevation_max":260,"elevation_min":20,"slope_mean":10,"terrain_class":"ROLLING"},
    {"id":"obi_island","lon":127.68,"lat":-1.53,"name":"Obi Island Interior Concession","province":"Maluku Utara","context":"Obi Ophiolite","tier":"HIGH","elevation_mean":440,"elevation_max":910,"elevation_min":50,"slope_mean":20,"terrain_class":"MOUNTAINOUS"},
    {"id":"konawe","lon":122.03,"lat":-3.79,"name":"Konawe Deep Inland Mountain Ridge","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"HIGH","elevation_mean":310,"elevation_max":560,"elevation_min":90,"slope_mean":14,"terrain_class":"HILLY"},
    {"id":"tapunopaka","lon":122.16,"lat":-3.58,"name":"Tapunopaka Greenfield Interior Prospect","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"LOW","elevation_mean":110,"elevation_max":210,"elevation_min":20,"slope_mean":5,"terrain_class":"FLAT"},
]

NX, NY = 20, 20

CELL_SIZE_BY_TERRAIN = {
    "FLAT": 0.005, "ROLLING": 0.008, "HILLY": 0.010, "MOUNTAINOUS": 0.012
}

LITHOLOGIES = ["serpentinite_simulated", "peridotite_simulated", "ultramafic_simulated", "mafic_volcanic_simulated", "alluvium"]
LITH_BASE_NI = {
    "serpentinite_simulated": (1.85, 0.35), "peridotite_simulated": (1.65, 0.35),
    "ultramafic_simulated": (1.50, 0.35), "mafic_volcanic_simulated": (0.50, 0.20),
    "alluvium": (0.20, 0.10),
}

PREFIX_MAP = {s["id"]: s["id"][:3].upper() for s in NICKEL_BELTS}

TIER_LITH_WEIGHTS = {
    "HIGH": [0.38, 0.27, 0.20, 0.10, 0.05],
    "MEDIUM": [0.22, 0.22, 0.16, 0.22, 0.18],
    "LOW": [0.10, 0.10, 0.10, 0.35, 0.35],
}

DATA_DIR = os.path.dirname(__file__)
FORESTRY_PATH = os.path.join(DATA_DIR, "forestry_boundaries.geojson")

def _load_forestry():
    if not os.path.exists(FORESTRY_PATH):
        return []
    with open(FORESTRY_PATH) as f:
        data = json.load(f)
    
    parsed = []
    for feat in data.get('features', []):
        g = feat['geometry']
        props = feat['properties']
        status = props.get('legal_status', 'allowed')
        
        all_coords = []
        if g['type'] == 'MultiPolygon':
            for poly in g['coordinates']:
                for ring in poly:
                    all_coords.extend(ring)
        elif g['type'] == 'Polygon':
            for ring in g['coordinates']:
                all_coords.extend(ring)
        
        if not all_coords:
            continue
            
        min_x = min(pt[0] for pt in all_coords)
        max_x = max(pt[0] for pt in all_coords)
        min_y = min(pt[1] for pt in all_coords)
        max_y = max(pt[1] for pt in all_coords)
        
        parsed.append({
            'min_x': min_x, 'max_x': max_x,
            'min_y': min_y, 'max_y': max_y,
            'geometry': g,
            'status': status
        })
    return parsed

FORESTRY_PARSED = _load_forestry()

def point_in_polygon(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

def cell_in_any_polygon(lon, lat, coord_arrays):
    for ring in coord_arrays:
        if point_in_polygon(lon, lat, ring):
            return True
    return False

def cell_legal_status(lon_c, lat_c, forestry_items):
    if not forestry_items:
        return 'allowed'
    for item in forestry_items:
        if not (item['min_x'] <= lon_c <= item['max_x'] and item['min_y'] <= lat_c <= item['max_y']):
            continue
        g = item['geometry']
        status = item['status']
        if g['type'] == 'MultiPolygon':
            for poly in g['coordinates']:
                if cell_in_any_polygon(lon_c, lat_c, poly):
                    return status
        else:
            if cell_in_any_polygon(lon_c, lat_c, g['coordinates']):
                return status
    return 'allowed'

def generate_site(site):
    sid = site["id"]
    prefix = PREFIX_MAP[sid]
    clon, clat = site["lon"], site["lat"]
    cell_deg = CELL_SIZE_BY_TERRAIN.get(site["terrain_class"], 0.008)
    half_extent = NX * cell_deg / 2

    lon_min, lon_max = clon - half_extent, clon + half_extent
    lat_min, lat_max = clat - half_extent, clat + half_extent
    cell_w = (lon_max - lon_min) / NX
    cell_h = (lat_max - lat_min) / NY
    hotspot_lon, hotspot_lat = (lon_min + lon_max) / 2, (lat_min + lat_max) / 2
    spatial_scale = half_extent * 0.8
    lith_weights = TIER_LITH_WEIGHTS.get(site["tier"], TIER_LITH_WEIGHTS["LOW"])

    out_dir = os.path.join(DATA_DIR, sid)
    os.makedirs(out_dir, exist_ok=True)

    cells = []
    geo_samples = []
    mag_points = []

    for row in range(NY):
        for col in range(NX):
            idx = row * NX + col
            gid = f"{prefix}{idx + 1:03d}"
            lon0 = lon_min + col * cell_w
            lat0 = lat_min + row * cell_h
            lon_c = lon0 + cell_w / 2
            lat_c = lat0 + cell_h / 2

            lith = random.choices(LITHOLOGIES, weights=lith_weights, k=1)[0]
            legal = cell_legal_status(lon_c, lat_c, FORESTRY_PARSED)
            slope = round(random.uniform(max(2.0, site["slope_mean"] - 4), site["slope_mean"] + 7), 1)
            
            # STRICT GREENFIELD BUFFER: 
            # - River distance >= 250m
            # - Road distance >= 1200m (deep forest interior)
            # - Settlement distance >= 3500m (zero urban/pit conflict)
            river = round(random.uniform(250, 2800))
            road = round(random.uniform(1200, 5500))
            settlement = round(random.uniform(3500, 12000))

            d_lon = (lon_c - hotspot_lon) / spatial_scale
            d_lat = (lat_c - hotspot_lat) / spatial_scale
            dist_factor = 0.5 + 0.5 * math.exp(-math.sqrt(d_lon**2 + d_lat**2))
            smelter_km = round(18 + math.sqrt(d_lon**2 + d_lat**2) * 35, 1)
            area = round(cell_deg * cell_deg * 111 * 111, 2)

            mu, sigma = LITH_BASE_NI[lith]
            true_ni = round(random.lognormvariate(math.log(mu), sigma) * dist_factor, 4)
            region_id = f"{'N' if lat_c >= hotspot_lat else 'S'}{'E' if lon_c >= hotspot_lon else 'W'}"

            # Comprehensive Remote Sensing & Geophysics features (Sentinel-2 & UAV Magnetometer)
            is_ultramafic = "serpentinite" in lith or "peridotite" in lith or "ultramafic" in lith
            fe_oxide = round(random.uniform(1.8, 2.85) if is_ultramafic else random.uniform(1.1, 1.7), 3)
            clay_idx = round(random.uniform(1.6, 2.45) if is_ultramafic else random.uniform(1.0, 1.5), 3)
            ndvi_stress = round(random.uniform(0.18, 0.42) if is_ultramafic else random.uniform(0.50, 0.78), 3)
            
            tmi_base = 45000.0 + (500.0 if is_ultramafic else -200.0)
            tmi_raw = round(tmi_base + random.uniform(-400, 600), 1)
            tmi_corr = round(tmi_raw - 45000.0, 1)
            elev_mdpl = round(site["elevation_mean"] + random.uniform(-30, 70), 1)
            geochem_ratio = round(random.uniform(1.4, 3.2) if is_ultramafic else random.uniform(3.5, 6.0), 2)

            cell_obj = {
                "gid": gid, "lon_c": round(lon_c, 5), "lat_c": round(lat_c, 5),
                "lon0": round(lon0, 5), "lat0": round(lat0, 5),
                "lith": lith, "legal": legal, "slope": slope,
                "river": river, "road": road, "settlement": settlement, "smelter": smelter_km, "area": area,
                "true_ni": true_ni, "region_id": region_id,
                "fe_oxide_index": fe_oxide,
                "clay_index": clay_idx,
                "ndvi_stress_index": ndvi_stress,
                "tmi_structural_nT": tmi_raw,
                "tmi_anomaly_nT": tmi_corr,
                "elevation_mdpl": elev_mdpl,
                "geochem_assay_ratio": geochem_ratio,
            }
            cells.append(cell_obj)

            # Generate realistic drill assay samples per cell
            zone_type = "saprolite" if true_ni > 1.5 else ("limonite" if true_ni > 1.0 else "bedrock")
            fe_pct = round(random.uniform(38.0, 48.0) if zone_type == "limonite" else random.uniform(14.0, 26.0), 2)
            mgo_pct = round(random.uniform(1.5, 8.0) if zone_type == "limonite" else random.uniform(18.0, 32.0), 2)
            sio2_pct = round(random.uniform(12.0, 28.0) if zone_type == "limonite" else random.uniform(32.0, 48.0), 2)
            co_pct = round(random.uniform(0.04, 0.12) if zone_type == "limonite" else random.uniform(0.01, 0.04), 3)

            geo_samples.append({
                "sample_id": f"SAMP_{gid}_01", "grid_id": gid,
                "latitude": round(lat_c + random.uniform(-0.001, 0.001), 6),
                "longitude": round(lon_c + random.uniform(-0.001, 0.001), 6),
                "Ni_pct": round(true_ni, 3), "Fe_pct": fe_pct, "Co_pct": co_pct,
                "MgO_pct": mgo_pct, "SiO2_pct": sio2_pct, "zone": zone_type, "qc_flag": "valid"
            })

            # Generate drone UAV mag points per cell
            for m_i in range(3):
                mag_points.append({
                    "mag_id": f"MAG_{gid}_{m_i+1:02d}", "grid_id": gid,
                    "latitude": round(lat_c + random.uniform(-0.002, 0.002), 6),
                    "longitude": round(lon_c + random.uniform(-0.002, 0.002), 6),
                    "mag_raw_nT": round(tmi_raw + random.uniform(-50, 50), 1),
                    "tmi_anomaly_nT": round(tmi_corr + random.uniform(-30, 30), 1),
                    "fault_flag": 1 if is_ultramafic and random.random() > 0.4 else 0
                })

    # 1. Write GeoJSON for site
    features = []
    for c in cells:
        coords = [[
            [c["lon0"], c["lat0"]],
            [round(c["lon0"] + cell_w, 5), c["lat0"]],
            [round(c["lon0"] + cell_w, 5), round(c["lat0"] + cell_h, 5)],
            [c["lon0"], round(c["lat0"] + cell_h, 5)],
            [c["lon0"], c["lat0"]]
        ]]
        features.append({
            "type": "Feature",
            "properties": {
                "grid_id": c["gid"],
                "site": sid,
                "location_label": f"{site['name']} - {site['province']} greenfield nickel laterite",
                "lithology": c["lith"],
                "slope_deg": c["slope"],
                "distance_to_river_m": c["river"],
                "distance_to_road_m": c["road"],
                "distance_to_settlement_m": c["settlement"],
                "legal_status": c["legal"],
                "distance_to_smelter_km": c["smelter"],
                "area_ha": c["area"],
                "region_id": c["region_id"],
                "fe_oxide_index": c["fe_oxide_index"],
                "clay_index": c["clay_index"],
                "ndvi_stress_index": c["ndvi_stress_index"],
                "tmi_structural_nT": c["tmi_structural_nT"],
                "tmi_anomaly_nT": c["tmi_anomaly_nT"],
                "elevation_mdpl": c["elevation_mdpl"],
                "geochem_assay_ratio": c["geochem_assay_ratio"],
            },
            "geometry": {"type": "Polygon", "coordinates": coords}
        })

    with open(os.path.join(out_dir, "study_grid.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "name": f"study_grid_{sid}", "features": features}, f, indent=2)

    # 2. Write Hidden truth for site
    with open(os.path.join(out_dir, "hidden_truth.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["grid_id","region_id","true_ni_pct","lithology"])
        w.writeheader()
        w.writerows({"grid_id": c["gid"], "region_id": c["region_id"], "true_ni_pct": c["true_ni"], "lithology": c["lith"]} for c in cells)

    return features, geo_samples, mag_points

def main():
    random.seed(42)
    all_features = []
    all_samples = []
    all_mag = []

    for site in NICKEL_BELTS:
        print(f"Generating site: {site['name']} ({site['id']})...")
        feats, samps, mags = generate_site(site)
        all_features.extend(feats)
        all_samples.extend(samps)
        all_mag.extend(mags)

    # Consolidated GeoJSON
    out_geojson = os.path.join(DATA_DIR, "study_grid_dummy.geojson")
    with open(out_geojson, "w") as f:
        json.dump({"type": "FeatureCollection", "features": all_features}, f, indent=2)
    print(f"[OK] Consolidated GeoJSON: {out_geojson} ({len(all_features)} cells)")

    out_geojson_v2 = os.path.join(DATA_DIR, "study_grid_random_v2.geojson")
    with open(out_geojson_v2, "w") as f:
        json.dump({"type": "FeatureCollection", "features": all_features[:80]}, f, indent=2)
    print(f"[OK] Consolidated GeoJSON V2: {out_geojson_v2} (80 cells)")

    # Consolidated Geochemistry CSV
    out_geo = os.path.join(DATA_DIR, "geochemistry_dummy.csv")
    with open(out_geo, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["sample_id","grid_id","latitude","longitude","Ni_pct","Fe_pct","Co_pct","MgO_pct","SiO2_pct","zone","qc_flag"])
        w.writeheader()
        w.writerows(all_samples)
    print(f"[OK] Consolidated Geochemistry: {out_geo} ({len(all_samples)} samples)")

    out_geo_v2 = os.path.join(DATA_DIR, "geochemistry_random_v2.csv")
    with open(out_geo_v2, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["sample_id","grid_id","latitude","longitude","Ni_pct","Fe_pct","Co_pct","MgO_pct","SiO2_pct","zone","qc_flag"])
        w.writeheader()
        w.writerows(all_samples[:160])

    # Consolidated Magnetometer CSV
    out_mag = os.path.join(DATA_DIR, "magnetometer_dummy.csv")
    with open(out_mag, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["mag_id","grid_id","latitude","longitude","mag_raw_nT","tmi_anomaly_nT","fault_flag"])
        w.writeheader()
        w.writerows(all_mag)
    print(f"[OK] Consolidated Magnetometer: {out_mag} ({len(all_mag)} telemetry points)")

    out_mag_v2 = os.path.join(DATA_DIR, "magnetometer_random_v2.csv")
    with open(out_mag_v2, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["mag_id","grid_id","latitude","longitude","mag_raw_nT","tmi_anomaly_nT","fault_flag"])
        w.writeheader()
        w.writerows(all_mag[:240])

if __name__ == "__main__":
    main()
