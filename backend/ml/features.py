import json, os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
GRID_GEOJSON = os.path.join(DATA_DIR, "study_grid_dummy.geojson")
OUTPUT_CSV = os.path.join(DATA_DIR, "training_features.csv")

LITHOLOGY_ORDER = [
    "alluvium", "andesite", "lahar_deposit", "mafic_volcanic_simulated",
    "peridotite_simulated", "serpentinite_simulated", "tuff",
    "ultramafic_simulated", "volcanic_breccia",
]
LEGAL_ORDER = ["allowed", "conditional", "no_go"]

def load_grid_geojson(path=GRID_GEOJSON):
    with open(path, encoding="utf-8") as f:
        geojson = json.load(f)
    rows = []
    for feat in geojson["features"]:
        p = feat["properties"]
        rows.append({
            "grid_id": p["grid_id"],
            "lithology": p["lithology"],
            "slope_deg": float(p["slope_deg"]),
            "distance_to_river_m": float(p["distance_to_river_m"]),
            "distance_to_road_m": float(p["distance_to_road_m"]),
            "legal_status": p["legal_status"],
            "distance_to_smelter_km": float(p["distance_to_smelter_km"]),
            "area_ha": float(p["area_ha"]),
            "longitude": feat["geometry"]["coordinates"][0][0][0],
            "latitude": feat["geometry"]["coordinates"][0][0][1],
            "region_id": p.get("region_id", ""),
        })
    return pd.DataFrame(rows)

def encode_categoricals(df):
    for lith in LITHOLOGY_ORDER:
        df[f"lith_{lith}"] = (df["lithology"] == lith).astype(int)
    for leg in LEGAL_ORDER:
        col = f"legal_{leg}"
        if leg == "no_go":
            df[col] = (df["legal_status"].isin(["no-go", "no_go"])).astype(int)
        else:
            df[col] = (df["legal_status"] == leg).astype(int)
    return df

def build_feature_matrix(grid_path=GRID_GEOJSON, output_path=OUTPUT_CSV):
    df = load_grid_geojson(grid_path)
    df = encode_categoricals(df)
    df.to_csv(output_path, index=False)
    print(f"Feature matrix saved: {output_path} ({len(df)} cells, {len(df.columns)} columns)")
    return df

if __name__ == "__main__":
    build_feature_matrix()
