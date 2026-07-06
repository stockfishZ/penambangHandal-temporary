import json
import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
GRID_GEOJSON = os.path.join(DATA_DIR, "study_grid_dummy.geojson")
GEOCHEM_CSV = os.path.join(DATA_DIR, "geochemistry_dummy.csv")
MAGNET_CSV = os.path.join(DATA_DIR, "magnetometer_dummy.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "training_features.csv")

LITHOLOGY_ORDER = [
    "alluvium", "andesite", "lahar_deposit", "mafic_volcanic_simulated",
    "peridotite_simulated", "serpentinite_simulated", "tuff",
    "ultramafic_simulated", "volcanic_breccia",
]

LEGAL_ORDER = ["allowed", "conditional", "no_go"]

def load_grid_geojson(path: str = GRID_GEOJSON) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8") as f:
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

def load_geochemistry(path: str = GEOCHEM_CSV) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df[df["qc_flag"] == "valid"]
    agg = df.groupby("grid_id").agg({
        "Ni_pct": "mean",
        "Fe_pct": "mean",
        "Co_pct": "mean",
        "MgO_pct": "mean",
        "SiO2_pct": "mean",
    }).reset_index()
    agg.columns = ["grid_id", "Ni_pct_mean", "Fe_pct_mean", "Co_pct_mean", "MgO_pct_mean", "SiO2_pct_mean"]
    return agg

def load_magnetometer(path: str = MAGNET_CSV) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df[df["qc_flag"] == "valid"]
    agg = df.groupby("grid_id").agg(
        mag_mean_nT=("mag_raw_nT", "mean"),
        mag_std_nT=("mag_raw_nT", "std"),
    ).reset_index()
    return agg

def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    for lith in LITHOLOGY_ORDER:
        df[f"lith_{lith}"] = (df["lithology"] == lith).astype(int)
    for leg in LEGAL_ORDER:
        col = f"legal_{leg}"
        if leg == "no_go":
            df[col] = (df["legal_status"].isin(["no-go", "no_go"])).astype(int)
        else:
            df[col] = (df["legal_status"] == leg).astype(int)
    return df

def build_feature_matrix(
    grid_path: str = GRID_GEOJSON,
    geochem_path: str = GEOCHEM_CSV,
    magnet_path: str = MAGNET_CSV,
    output_path: str = OUTPUT_CSV,
) -> pd.DataFrame:
    grid_df = load_grid_geojson(grid_path)
    geochem_df = load_geochemistry(geochem_path)
    magnet_df = load_magnetometer(magnet_path)

    df = grid_df.merge(geochem_df, on="grid_id", how="left")
    df = df.merge(magnet_df, on="grid_id", how="left")

    df = encode_categoricals(df)

    df.to_csv(output_path, index=False)
    print(f"Feature matrix saved: {output_path} ({len(df)} cells, {len(df.columns)} columns)")
    return df

if __name__ == "__main__":
    build_feature_matrix()
