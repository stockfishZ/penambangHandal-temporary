import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")

def generate_labels(features: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, row in features.iterrows():
        score = _compute_prospectivity(row)
        rows.append({"grid_id": row["grid_id"], "prospectivity_score": round(score, 1)})
    return pd.DataFrame(rows)

def _compute_prospectivity(row: pd.Series) -> float:
    # Step 1: Hard 0 checks (deterministic exclusion per Milestone 3.3)
    if row.get("legal_no_go", 0) == 1:
        return 0.0
    if row["distance_to_road_m"] < 500:
        return 0.0

    # Step 2: Ni grade score (0-3 points)
    ni = row["Ni_pct_mean"]
    if ni >= 1.5:
        ni_score = 3.0
    elif ni >= 1.0:
        ni_score = 2.0 + (ni - 1.0) / 0.5
    elif ni >= 0.5:
        ni_score = 1.0 + (ni - 0.5) / 0.5
    else:
        ni_score = max(0.0, ni / 0.5)

    # Step 3: Lithology score (0-2 points) — ultramafic = host rock = best
    is_ultramafic = any(row.get(f"lith_{k}", 0) == 1 for k in
                        ["ultramafic_simulated", "serpentinite_simulated", "peridotite_simulated"])
    is_mafic = row.get("lith_mafic_volcanic_simulated", 0) == 1

    if is_ultramafic:
        lith_score = 2.0
    elif is_mafic:
        lith_score = 1.0
    else:
        lith_score = 0.3

    # Step 4: Legal/regulatory score (0-2 points)
    if row.get("legal_allowed", 0) == 1:
        legal_score = 2.0
    elif row.get("legal_conditional", 0) == 1:
        legal_score = 1.0
    else:
        legal_score = 0.0

    # Step 5: Logistics score (0-2 points)
    log_score = 0.0

    road_km = row["distance_to_road_m"] / 1000
    if 0.5 <= road_km <= 5.0:
        log_score += 0.8
    elif road_km <= 10.0:
        log_score += 0.5
    else:
        log_score += 0.2

    smelter = row["distance_to_smelter_km"]
    if smelter <= 50:
        log_score += 1.0
    elif smelter <= 90:
        log_score += 0.8
    elif smelter <= 140:
        log_score += 0.5
    else:
        log_score += 0.2

    river = row["distance_to_river_m"]
    if 300 <= river <= 900:
        log_score += 0.2
    elif river >= 100:
        log_score += 0.1

    # Step 6: Slope penalty (0 to -1)
    slope = row["slope_deg"]
    if slope > 35:
        slope_penalty = 1.0
    elif slope > 25:
        slope_penalty = 0.5
    elif slope > 15:
        slope_penalty = 0.2
    else:
        slope_penalty = 0.0

    raw = ni_score + lith_score + legal_score + log_score - slope_penalty
    return max(0.0, min(10.0, raw))

def save_labels(labels: pd.DataFrame, path: str = LABELS_CSV):
    out = labels.copy()
    out.loc[out["prospectivity_score"] == 0.0, "prospectivity_score"] = float("nan")
    out.to_csv(path, index=False, na_rep="")
    non_null = out["prospectivity_score"].dropna()
    print(f"Labels saved: {path} ({len(out)} cells, {len(non_null)} scored, {len(out) - len(non_null)} blocked)" )
    if len(non_null):
        print(f"  Distribution:\n{non_null.describe()}")

def generate_and_save(features_path: str = FEATURES_CSV, output_path: str = LABELS_CSV) -> pd.DataFrame:
    features = pd.read_csv(features_path)
    labels = generate_labels(features)
    save_labels(labels, output_path)
    return labels

if __name__ == "__main__":
    generate_and_save()
