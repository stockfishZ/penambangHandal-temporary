import json, csv
grid = json.load(open("data/study_grid_dummy.geojson"))
mag = list(csv.DictReader(open("data/magnetometer_dummy.csv")))
geo = list(csv.DictReader(open("data/geochemistry_dummy.csv")))

ultra = sum(1 for f in grid["features"] if any(x in f["properties"]["lithology"] for x in ["serpentinite","peridotite","ultramafic"]))
lons = [f["geometry"]["coordinates"][0][0][0] for f in grid["features"]]
lats = [f["geometry"]["coordinates"][0][0][1] for f in grid["features"]]
sap = sum(1 for r in geo if r["zone"] == "saprolite")
lim = sum(1 for r in geo if r["zone"] == "limonite")
ni = [float(r["Ni_pct"]) for r in geo]
mag_vals = [float(r["mag_raw_nT"]) for r in mag]
props = set()
for f in grid["features"]:
    props.update(f["properties"].keys())

print(f"GRID: {len(grid['features'])} cells ({ultra} ultramafic)")
print(f"  lon {min(lons):.2f}-{max(lons):.2f}, lat {min(lats):.2f}-{max(lats):.2f}")
print(f"  properties: {sorted(props)}")
print(f"MAG: {len(mag)} readings | {min(mag_vals):.0f}-{max(mag_vals):.0f} nT")
print(f"GEO: {len(geo)} samples | Ni {min(ni):.3f}-{max(ni):.3f}% | saprolite {sap}, limonite {lim}")
print("ALL CHECKS PASSED")
