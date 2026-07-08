"""Stochastic forward model: generates prospectivity labels from HIDDEN ground truth.
Formula is structurally different from the inference fallback to prevent closed-loop scoring.
The label depends on true_ni_pct (hidden from ML features) with multiplicative interactions.

Data assumptions documented in vault/geonirisk/research/SOURCES.md
"""
import os
import math
import pandas as pd
import numpy as np

np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
HIDDEN_CSV = os.path.join(DATA_DIR, "hidden_truth.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")


def compute_prospectivity(row: pd.Series, true_ni: float) -> float:
    legal_no_go = row.get("legal_no_go", 0)
    if legal_no_go == 1:
        return 0.0
    dist_road = row.get("distance_to_road_m", 9999)
    if dist_road < 500:
        return 0.0

    # Michaelis-Menten curve — fundamentally different from the sigmoid used in inference fallback
    # K_m = 0.6, V_max = 6.0
    ni_score = 6.0 * true_ni / (true_ni + 0.6)

    # Lithology multiplier: ultramafic rocks amplify Ni score (multiplicative, not additive)
    lith = str(row.get("lithology", ""))
    is_ultramafic = any(x in lith for x in ["serpentinite", "peridotite", "ultramafic"])
    is_mafic = "mafic" in lith
    if is_ultramafic:
        lith_mult = 1.5
    elif is_mafic:
        lith_mult = 1.15
    else:
        lith_mult = 0.7

    # Legal acts as a gate (multiplicative)
    legal_allowed = row.get("legal_allowed", 0)
    legal_conditional = row.get("legal_conditional", 0)
    if legal_allowed == 1:
        legal_gate = 1.0
    elif legal_conditional == 1:
        legal_gate = 0.65
    else:
        legal_gate = 0.0

    # Logistics bonus (additive, different thresholds from inference fallback)
    log_bonus = 0.0
    road_km = row.get("distance_to_road_m", 9999) / 1000
    if road_km <= 3.0:
        log_bonus += 0.6
    elif road_km <= 7.0:
        log_bonus += 0.4
    elif road_km <= 15.0:
        log_bonus += 0.15

    smelter = row.get("distance_to_smelter_km", 999)
    if smelter <= 35:
        log_bonus += 0.7
    elif smelter <= 70:
        log_bonus += 0.45
    elif smelter <= 120:
        log_bonus += 0.2
    elif smelter <= 200:
        log_bonus += 0.1

    # Interaction: hidden Ni × slope penalty
    slope = row.get("slope_deg", 0)
    if slope > 30:
        slp = 1.2
    elif slope > 20:
        slp = 0.6
    elif slope > 12:
        slp = 0.2
    else:
        slp = 0.0
    slope_penalty = slp * (0.5 + 0.5 * true_ni / (true_ni + 0.5))

    raw = ni_score * lith_mult * legal_gate + log_bonus - slope_penalty

    # Heteroscedastic noise: scales with true_ni
    noise_sigma = 0.3 * (1.0 + 0.6 * true_ni / (true_ni + 0.5))
    noise = np.random.normal(0, noise_sigma)

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
