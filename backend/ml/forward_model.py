"""Stochastic forward model: generates prospectivity labels from HIDDEN ground truth.
Breaks the circular dependency of the old labels.py which used observed features.

The label depends on true_ni_pct (a hidden variable NOT in the ML feature set),
plus lithology, legal status, and accessibility. Gaussian noise is added so the
ML model must learn to filter noise from multiple signals — genuine learning.

Data assumptions documented in vault/geonirisk/research/SOURCES.md
"""
import os
import random
import math
import pandas as pd
import numpy as np

random.seed(42)
np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
HIDDEN_CSV = os.path.join(DATA_DIR, "hidden_truth.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")


def compute_prospectivity(row: pd.Series, true_ni: float) -> float:
    # Step 1: Hard zeros (same as old labels.py — rule-based exclusions)
    legal_no_go = row.get("legal_no_go", 0)
    if legal_no_go == 1:
        return 0.0
    dist_road = row.get("distance_to_road_m", 9999)
    if dist_road < 500:
        return 0.0

    # Step 2: Ni grade score from HIDDEN true Ni (NOT from observed Ni_pct_mean)
    # sigmoid centered at 0.8% Ni, scaled to 0-5 points
    ni_score = 5.0 / (1.0 + math.exp(-(true_ni - 0.8) / 0.5))

    # Step 3: Lithology bonus from hidden truth
    lith = str(row.get("lithology", ""))
    is_ultramafic = any(x in lith for x in ["serpentinite", "peridotite", "ultramafic"])
    is_mafic = "mafic" in lith
    if is_ultramafic:
        lith_score = 2.0
    elif is_mafic:
        lith_score = 1.0
    else:
        lith_score = 0.3

    # Step 4: Legal/regulatory score (0-2)
    legal_allowed = row.get("legal_allowed", 0)
    legal_conditional = row.get("legal_conditional", 0)
    if legal_allowed == 1:
        legal_score = 2.0
    elif legal_conditional == 1:
        legal_score = 1.0
    else:
        legal_score = 0.0

    # Step 5: Logistics score (0-1)
    log_score = 0.0
    road_km = row.get("distance_to_road_m", 9999) / 1000
    if 0.5 <= road_km <= 5.0:
        log_score += 0.5
    elif road_km <= 10.0:
        log_score += 0.3
    else:
        log_score += 0.1

    smelter = row.get("distance_to_smelter_km", 999)
    if smelter <= 50:
        log_score += 0.5
    elif smelter <= 90:
        log_score += 0.4
    elif smelter <= 140:
        log_score += 0.25
    else:
        log_score += 0.1

    # Step 6: Slope penalty (0 to -1)
    slope = row.get("slope_deg", 0)
    if slope > 35:
        slope_penalty = 1.0
    elif slope > 25:
        slope_penalty = 0.5
    elif slope > 15:
        slope_penalty = 0.2
    else:
        slope_penalty = 0.0

    raw = ni_score + lith_score + legal_score + log_score - slope_penalty
    # Add Gaussian noise — the ML model must learn to filter this
    noise = np.random.normal(0, 0.4)
    return max(0.0, min(10.0, raw + noise))


def generate_labels(features_path: str = FEATURES_CSV,
                    hidden_path: str = HIDDEN_CSV,
                    output_path: str = LABELS_CSV) -> pd.DataFrame:
    features = pd.read_csv(features_path)
    hidden = pd.read_csv(hidden_path)

    merged = features.merge(hidden, on="grid_id", suffixes=("_feat", "_hidden"))

    rows = []
    for _, row in merged.iterrows():
        true_ni = row["true_ni_pct"]
        score = compute_prospectivity(row, true_ni)
        rows.append({"grid_id": row["grid_id"], "prospectivity_score": round(score, 1)})

    labels = pd.DataFrame(rows)

    out = labels.copy()
    out.loc[out["prospectivity_score"] == 0.0, "prospectivity_score"] = float("nan")
    out.to_csv(output_path, index=False, na_rep="")
    non_null = out["prospectivity_score"].dropna()
    print(f"Labels saved: {output_path} ({len(out)} cells, {len(non_null)} scored, "
          f"{len(out) - len(non_null)} blocked)")
    if len(non_null):
        print(f"  Distribution:\n{non_null.describe()}")
    return labels


if __name__ == "__main__":
    generate_labels()
