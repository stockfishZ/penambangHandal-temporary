"""Generate Halmahera (Weda Bay) nickel laterite dummy data.
Scaled to 400+ cells with hidden ground truth for ML validation.

Data assumptions documented in vault/geonirisk/research/SOURCES.md

Geochem zone ranges — MBMA (2021) Indonesian Nickel Laterite Benchmarking Study;
Golightly (1981) Econ. Geol. 75, 710-735; Brand et al. (1998) AGSO J. 17(4), 81-88.
Magnetometer baselines — Telford et al. (1990) Applied Geophysics, 2nd ed.
Lithology distribution — Sukamto (1975) GRDC; Hall & Wilson (2000) J. Asian Earth Sci.
"""
import json, csv, random, math, os
random.seed(42)

NX, NY = 20, 20
N_CELLS = NX * NY

LON_MIN, LON_MAX = 127.65, 127.65 + NX * 0.016
LAT_MIN, LAT_MAX = 0.350, 0.350 + NY * 0.016
CELL_W = (LON_MAX - LON_MIN) / NX
CELL_H = (LAT_MAX - LAT_MIN) / NY

HOTSPOT_LON = (LON_MIN + LON_MAX) / 2
HOTSPOT_LAT = (LAT_MIN + LAT_MAX) / 2
SPATIAL_SCALE = 0.1  # degrees — controls how fast Ni decays from hotspot

LITHOLOGIES = [
    "serpentinite_simulated", "peridotite_simulated", "ultramafic_simulated",
    "mafic_volcanic_simulated", "alluvium"
]
LITH_WEIGHTS = [0.40, 0.25, 0.20, 0.10, 0.05]
LEGAL_STATUSES = ["allowed", "allowed", "allowed", "conditional", "no-go"]

LITH_BASE_NI = {
    "serpentinite_simulated": (1.8, 0.4),
    "peridotite_simulated": (1.6, 0.4),
    "ultramafic_simulated": (1.5, 0.4),
    "mafic_volcanic_simulated": (0.5, 0.2),
    "alluvium": (0.2, 0.1),
}

ZONE_NI_NOISE = {
    "saprolite": 0.20,
    "limonite": 0.20,
    "transition": 0.25,
    "soil": 0.30,
    "bedrock": 0.15,
}

DATA_DIR = os.path.dirname(__file__)

cells = []
for row in range(NY):
    for col in range(NX):
        idx = row * NX + col
        gid = f"H{idx + 1:03d}"
        lon0 = LON_MIN + col * CELL_W
        lat0 = LAT_MIN + row * CELL_H
        lon_c = lon0 + CELL_W / 2
        lat_c = lat0 + CELL_H / 2

        lith = random.choices(LITHOLOGIES, weights=LITH_WEIGHTS, k=1)[0]
        legal = random.choices(LEGAL_STATUSES, k=1)[0]
        slope = round(random.uniform(2.0, 18.0), 1)
        river = round(random.uniform(80, 1200))
        road = round(random.uniform(300, 3500))

        d_lon = (lon_c - HOTSPOT_LON) / SPATIAL_SCALE
        d_lat = (lat_c - HOTSPOT_LAT) / SPATIAL_SCALE
        dist_factor = 0.5 + 0.5 * math.exp(-math.sqrt(d_lon**2 + d_lat**2))
        smelter_km = round(25 + math.sqrt(d_lon**2 + d_lat**2) * 20, 1)
        area = round(random.uniform(100, 160), 1)

        mu, sigma = LITH_BASE_NI[lith]
        true_ni = round(random.lognormvariate(math.log(mu), sigma) * dist_factor, 4)

        region_id = f"{'N' if lat_c >= HOTSPOT_LAT else 'S'}{'E' if lon_c >= HOTSPOT_LON else 'W'}"

        cells.append({
            "gid": gid, "lon_c": round(lon_c, 5), "lat_c": round(lat_c, 5),
            "lon0": round(lon0, 5), "lat0": round(lat0, 5),
            "lith": lith, "legal": legal, "slope": slope,
            "river": river, "road": road, "smelter": smelter_km, "area": area,
            "true_ni": true_ni, "region_id": region_id,
        })

# 1. Write GeoJSON
features = []
for c in cells:
    lon0, lat0, cw, ch = c["lon0"], c["lat0"], CELL_W, CELL_H
    coords = [
        [lon0, lat0],
        [round(lon0 + cw, 5), lat0],
        [round(lon0 + cw, 5), round(lat0 + ch, 5)],
        [lon0, round(lat0 + ch, 5)],
        [lon0, lat0]
    ]
    features.append({
        "type": "Feature",
        "properties": {
            "grid_id": c["gid"],
            "location_label": "Weda Bay - Halmahera nickel laterite",
            "lithology": c["lith"],
            "slope_deg": c["slope"],
            "distance_to_river_m": c["river"],
            "distance_to_road_m": c["road"],
            "legal_status": c["legal"],
            "distance_to_smelter_km": c["smelter"],
            "area_ha": c["area"],
            "region_id": c["region_id"],
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [coords]
        }
    })

geojson = {
    "type": "FeatureCollection",
    "name": "study_grid_halmahera_weda_bay",
    "features": features
}

with open(os.path.join(DATA_DIR, "study_grid_dummy.geojson"), "w") as f:
    json.dump(geojson, f, indent=2)
print(f"[OK] study_grid_dummy.geojson -- {len(features)} features (Halmahera {NX}x{NY})")

# 2. Write Magnetometer CSV
mag_rows = []
for c in cells:
    n_points = 3 if random.random() < 0.2 else 2
    for p in range(n_points):
        lon_off = random.uniform(0.002, CELL_W - 0.002)
        lat_off = random.uniform(0.002, CELL_H - 0.002)
        lat = round(c["lat0"] + lat_off, 6)
        lon = round(c["lon0"] + lon_off, 6)
        pid = f"M{c['gid']}{p+1}"

        base = random.uniform(42800, 44000)
        if "serpentinite" in c["lith"]:
            base += random.uniform(1500, 3500)
        elif "peridotite" in c["lith"]:
            base += random.uniform(800, 2200)
        elif "ultramafic" in c["lith"]:
            base += random.uniform(500, 1800)
        elif "mafic" in c["lith"]:
            base += random.uniform(0, 500)
        mag = round(base + random.uniform(-200, 200), 1)

        hour = 7 + random.randint(0, 9)
        minute = random.randint(0, 59)
        mag_rows.append({
            "point_id": pid, "grid_id": c["gid"],
            "latitude": lat, "longitude": lon,
            "time": f"2026-07-03 {hour:02d}:{minute:02d}:00",
            "line_id": f"L{random.randint(1, 6):02d}",
            "mag_raw_nT": mag, "qc_flag": "valid"
        })

with open(os.path.join(DATA_DIR, "magnetometer_dummy.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["point_id","grid_id","latitude","longitude","time","line_id","mag_raw_nT","qc_flag"])
    w.writeheader()
    w.writerows(mag_rows)
print(f"[OK] magnetometer_dummy.csv -- {len(mag_rows)} readings")

# 3. Write Geochemistry CSV
geo_rows = []
for c in cells:
    for p in range(2):
        lon_off = random.uniform(0.003, CELL_W - 0.003)
        lat_off = random.uniform(0.003, CELL_H - 0.003)
        lat = round(c["lat0"] + lat_off, 6)
        lon = round(c["lon0"] + lon_off, 6)
        sid = f"S{c['gid']}{p+1}"

        is_ultramafic = any(x in c["lith"] for x in ["serpentinite", "peridotite", "ultramafic"])
        if is_ultramafic:
            zone = random.choices(
                ["limonite", "saprolite", "transition", "soil"],
                weights=[0.35, 0.30, 0.20, 0.15], k=1
            )[0]
        else:
            zone = random.choices(
                ["soil", "limonite", "bedrock"],
                weights=[0.50, 0.30, 0.20], k=1
            )[0]

        noise = random.gauss(0, ZONE_NI_NOISE[zone])
        ni = round(max(0.01, c["true_ni"] + noise), 3)

        if zone == "saprolite":
            fe = round(random.uniform(12, 28), 2)
            co = round(random.uniform(0.01, 0.05), 3)
            mgo = round(random.uniform(15, 30), 2)
            sio2 = round(random.uniform(28, 40), 2)
        elif zone == "limonite":
            fe = round(random.uniform(35, 50), 2)
            co = round(random.uniform(0.02, 0.10), 3)
            mgo = round(random.uniform(1, 8), 2)
            sio2 = round(random.uniform(30, 45), 2)
        elif zone == "transition":
            fe = round(random.uniform(20, 35), 2)
            co = round(random.uniform(0.01, 0.07), 3)
            mgo = round(random.uniform(8, 18), 2)
            sio2 = round(random.uniform(35, 48), 2)
        elif zone == "bedrock":
            fe = round(random.uniform(5, 12), 2)
            co = round(random.uniform(0.003, 0.015), 3)
            mgo = round(random.uniform(35, 48), 2)
            sio2 = round(random.uniform(38, 50), 2)
        else:  # soil
            fe = round(random.uniform(10, 25), 2)
            co = round(random.uniform(0.005, 0.025), 3)
            mgo = round(random.uniform(2, 10), 2)
            sio2 = round(random.uniform(45, 60), 2)

        if not is_ultramafic and ni > 0.6:
            ni = round(random.uniform(0.1, 0.5), 3)

        geo_rows.append({
            "sample_id": sid, "grid_id": c["gid"],
            "latitude": lat, "longitude": lon,
            "Ni_pct": ni, "Fe_pct": fe, "Co_pct": co,
            "MgO_pct": mgo, "SiO2_pct": sio2,
            "zone": zone, "qc_flag": "valid"
        })

with open(os.path.join(DATA_DIR, "geochemistry_dummy.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["sample_id","grid_id","latitude","longitude","Ni_pct","Fe_pct","Co_pct","MgO_pct","SiO2_pct","zone","qc_flag"])
    w.writeheader()
    w.writerows(geo_rows)
print(f"[OK] geochemistry_dummy.csv -- {len(geo_rows)} samples")

# 4. Write Hidden Truth CSV (for forward model and evaluation — NOT exposed to ML features)
truth_rows = []
for c in cells:
    truth_rows.append({
        "grid_id": c["gid"],
        "region_id": c["region_id"],
        "true_ni_pct": c["true_ni"],
        "lithology": c["lith"],
    })

with open(os.path.join(DATA_DIR, "hidden_truth.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["grid_id", "region_id", "true_ni_pct", "lithology"])
    w.writeheader()
    w.writerows(truth_rows)
print(f"[OK] hidden_truth.csv -- {len(truth_rows)} cells with ground truth")

# Summary
ultra = sum(1 for c in cells if "serpentinite" in c["lith"] or "peridotite" in c["lith"] or "ultramafic" in c["lith"])
sap = sum(1 for r in geo_rows if r["zone"] == "saprolite")
lim = sum(1 for r in geo_rows if r["zone"] == "limonite")
ni_vals = [r["Ni_pct"] for r in geo_rows]
true_ni_vals = [c["true_ni"] for c in cells]
print(f"\n  Grids: {len(cells)} ({ultra} ultramafic)")
print(f"  Samples: {len(geo_rows)} ({lim} limonite, {sap} saprolite)")
print(f"  Hidden true Ni: {min(true_ni_vals):.3f} - {max(true_ni_vals):.3f}%")
print(f"  Observed Ni:    {min(ni_vals):.3f} - {max(ni_vals):.3f}%")
print(f"  Regions: {set(c['region_id'] for c in cells)}")
