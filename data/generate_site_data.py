"""Generate uniform 20x20 study grids + field data for all 8 NiTERRA sites.
Replaces the old 100x100 Halmahera-only generator.

Data assumptions documented in vault/geonirisk/research/SOURCES.md
"""
import json, csv, random, math, os
# ponytail: mag/geochem generation removed — teammates handle field data via droneGeophysics.py
random.seed(42)

SITES = [
    {"id":"sorowako","lon":121.35,"lat":-2.53,"name":"Sorowako","province":"Sulawesi Selatan","context":"East Sulawesi Ophiolite Belt","tier":"HIGH","elevation_mean":450,"elevation_max":600,"elevation_min":380,"slope_mean":12,"terrain_class":"HILLY"},
    {"id":"morowali","lon":121.93,"lat":-2.68,"name":"Morowali (Bungku)","province":"Sulawesi Tengah","context":"East Sulawesi Ophiolite Belt","tier":"HIGH","elevation_mean":200,"elevation_max":400,"elevation_min":50,"slope_mean":8,"terrain_class":"ROLLING"},
    {"id":"weda_bay","lon":128.05,"lat":0.52,"name":"Weda Bay","province":"Maluku Utara","context":"Halmahera Ophiolite","tier":"HIGH","elevation_mean":300,"elevation_max":800,"elevation_min":20,"slope_mean":18,"terrain_class":"MOUNTAINOUS"},
    {"id":"pomalaa","lon":121.63,"lat":-4.20,"name":"Pomalaa","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"MEDIUM","elevation_mean":150,"elevation_max":300,"elevation_min":10,"slope_mean":6,"terrain_class":"FLAT"},
    {"id":"gag_island","lon":129.88,"lat":-0.07,"name":"Gag Island","province":"Papua Barat Daya","context":"Waigeo Ophiolite","tier":"HIGH","elevation_mean":120,"elevation_max":250,"elevation_min":0,"slope_mean":10,"terrain_class":"ROLLING"},
    {"id":"obi_island","lon":127.72,"lat":-1.50,"name":"Obi Island","province":"Maluku Utara","context":"Obi Ophiolite","tier":"HIGH","elevation_mean":400,"elevation_max":900,"elevation_min":0,"slope_mean":20,"terrain_class":"MOUNTAINOUS"},
    {"id":"konawe","lon":122.11,"lat":-3.83,"name":"Konawe","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"HIGH","elevation_mean":250,"elevation_max":500,"elevation_min":50,"slope_mean":14,"terrain_class":"HILLY"},
    {"id":"tapunopaka","lon":122.18,"lat":-3.61,"name":"Tapunopaka","province":"Sulawesi Tenggara","context":"Southeast Sulawesi Ophiolite","tier":"LOW","elevation_mean":100,"elevation_max":200,"elevation_min":10,"slope_mean":5,"terrain_class":"FLAT"},
]

# ponytail: 20x20 = 400 cells per site. was 100x100 = 10,000.
NX, NY = 20, 20
N_CELLS = NX * NY

CELL_SIZE_BY_TERRAIN = {
    "FLAT": 0.005, "ROLLING": 0.008, "HILLY": 0.010, "MOUNTAINOUS": 0.012
}

LITHOLOGIES = ["serpentinite_simulated", "peridotite_simulated", "ultramafic_simulated", "mafic_volcanic_simulated", "alluvium"]
LITH_BASE_NI = {
    "serpentinite_simulated": (1.8, 0.4), "peridotite_simulated": (1.6, 0.4),
    "ultramafic_simulated": (1.5, 0.4), "mafic_volcanic_simulated": (0.5, 0.2),
    "alluvium": (0.2, 0.1),
}
ZONE_NI_NOISE = {"saprolite": 0.20, "limonite": 0.20, "transition": 0.25, "soil": 0.30, "bedrock": 0.15}
LEGAL_STATUSES = ["allowed", "allowed", "allowed", "conditional", "no-go"]

PREFIX_MAP = {s["id"]: s["id"][:3].upper() for s in SITES}  # sor→SOR, mor→MOR, wed→WED, pom→POM, gag→GAG, obi→OBI, kon→KON, tap→TAP

# Map tier to lithology weights: HIGH→more ultramafic
TIER_LITH_WEIGHTS = {
    "HIGH": [0.35, 0.25, 0.20, 0.12, 0.08],
    "MEDIUM": [0.20, 0.20, 0.15, 0.25, 0.20],
    "LOW": [0.10, 0.10, 0.10, 0.30, 0.40],
}

DATA_DIR = os.path.dirname(__file__)

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
    for row in range(NY):
        for col in range(NX):
            idx = row * NX + col
            gid = f"{prefix}{idx + 1:03d}"
            lon0 = lon_min + col * cell_w
            lat0 = lat_min + row * cell_h
            lon_c = lon0 + cell_w / 2
            lat_c = lat0 + cell_h / 2

            lith = random.choices(LITHOLOGIES, weights=lith_weights, k=1)[0]
            legal = random.choices(LEGAL_STATUSES, k=1)[0]
            slope = round(random.uniform(max(1, site["slope_mean"] - 5), site["slope_mean"] + 8), 1)
            river = round(random.uniform(80, 1200))
            road = round(random.uniform(300, 3500))

            d_lon = (lon_c - hotspot_lon) / spatial_scale
            d_lat = (lat_c - hotspot_lat) / spatial_scale
            dist_factor = 0.5 + 0.5 * math.exp(-math.sqrt(d_lon**2 + d_lat**2))
            smelter_km = round(10 + math.sqrt(d_lon**2 + d_lat**2) * 40, 1)
            area = round(cell_deg * cell_deg * 111 * 111, 2)  # approx km²→ha

            mu, sigma = LITH_BASE_NI[lith]
            true_ni = round(random.lognormvariate(math.log(mu), sigma) * dist_factor, 4)
            region_id = f"{'N' if lat_c >= hotspot_lat else 'S'}{'E' if lon_c >= hotspot_lon else 'W'}"

            cells.append({
                "gid": gid, "lon_c": round(lon_c, 5), "lat_c": round(lat_c, 5),
                "lon0": round(lon0, 5), "lat0": round(lat0, 5),
                "lith": lith, "legal": legal, "slope": slope,
                "river": river, "road": road, "smelter": smelter_km, "area": area,
                "true_ni": true_ni, "region_id": region_id,
            })

    # 1. GeoJSON
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
                "location_label": f"{site['name']} - {site['province']} nickel laterite",
                "lithology": c["lith"],
                "slope_deg": c["slope"],
                "distance_to_river_m": c["river"],
                "distance_to_road_m": c["road"],
                "legal_status": c["legal"],
                "distance_to_smelter_km": c["smelter"],
                "area_ha": c["area"],
                "region_id": c["region_id"],
            },
            "geometry": {"type": "Polygon", "coordinates": coords}
        })

    with open(os.path.join(out_dir, "study_grid.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "name": f"study_grid_{sid}", "features": features}, f, indent=2)
    print(f"  [OK] study_grid.geojson — {len(features)} cells")

    # 2. Hidden truth
    with open(os.path.join(out_dir, "hidden_truth.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["grid_id","region_id","true_ni_pct","lithology"])
        w.writeheader()
        w.writerows({"grid_id": c["gid"], "region_id": c["region_id"], "true_ni_pct": c["true_ni"], "lithology": c["lith"]} for c in cells)
    print(f"  [OK] hidden_truth.csv — {len(cells)} cells")

    ultra = sum(1 for c in cells if any(x in c["lith"] for x in ["serpentinite","peridotite","ultramafic"]))
    print(f"  => {len(cells)} grids ({ultra} ultramafic)")

def main():
    import sys
    targets = sys.argv[1:] if len(sys.argv) > 1 else [s["id"] for s in SITES]
    for site in SITES:
        if site["id"] in targets:
            print(f"\n=== {site['name']} ({site['id']}) — {site['terrain_class']} terrain, {NX}x{NY} grid ===")
            generate_site(site)

if __name__ == "__main__":
    main()
