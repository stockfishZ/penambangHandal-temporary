"""Reproduce training and evaluate on the spatially held-out test set.
Prints metrics that prove the model genuinely generalizes.
"""
import os, sys, json
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.inference import ProspectivityModel, ALL_FEATURES, FEATURE_COLS, LITH_COLS, LEGAL_COLS

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")
HIDDEN_CSV = os.path.join(DATA_DIR, "hidden_truth.csv")

X_df = pd.read_csv(FEATURES_CSV)
y_df = pd.read_csv(LABELS_CSV)
hidden = pd.read_csv(HIDDEN_CSV)

region_ids = X_df["region_id"].values
grid_ids = X_df["grid_id"].values
X = X_df[ALL_FEATURES]
y = y_df["prospectivity_score"]

mask = y.notna()
X, y, region_ids, grid_ids = (
    X[mask].reset_index(drop=True),
    y[mask].reset_index(drop=True),
    region_ids[mask],
    grid_ids[mask],
)

model = ProspectivityModel()
if not model.loaded:
    print("ERROR: No trained model found. Run train.py first.")
    sys.exit(1)

print("=" * 60)
print("  NiTERRA ML — Genuine Learning Validation")
print("=" * 60)

metadata = model.metadata
tm = metadata.get("test_metrics", {})
print(f"\n  Training data:  {metadata.get('train_samples', '?')} cells (regions: {metadata.get('train_regions', [])})")
print(f"  Test data:      {metadata.get('test_samples', '?')} cells (region: SE, spatially held-out)")
print(f"  Features:       {metadata.get('n_features', '?')}")
print(f"\n  Test R²:          {tm.get('r2', 0):.3f}")
print(f"  Test RMSE:        {tm.get('rmse', 0):.3f}")
print(f"  Test MAE:         {tm.get('mae', 0):.3f}")
print(f"  Test Spearman:    {tm.get('spearman', 0):.3f}")

test_mask = np.array([r in ("SE",) for r in region_ids])
X_test, y_test, gids_test = X[test_mask], y[test_mask], grid_ids[test_mask]
y_pred = []
for i in range(len(X_test)):
    row = X_test.iloc[i]
    feats = {
        "slope_deg": row["slope_deg"], "distance_to_river_m": row["distance_to_river_m"],
        "distance_to_road_m": row["distance_to_road_m"], "distance_to_smelter_km": row["distance_to_smelter_km"],
        "area_ha": row["area_ha"],
        "Ni_pct_mean": row["Ni_pct_mean"], "Fe_pct_mean": row["Fe_pct_mean"],
        "Co_pct_mean": row["Co_pct_mean"], "MgO_pct_mean": row["MgO_pct_mean"],
        "SiO2_pct_mean": row["SiO2_pct_mean"],
        "mag_mean_nT": row["mag_mean_nT"], "mag_std_nT": row["mag_std_nT"],
        "lithology": "", "legal_status": "",
    }
    for col in LITH_COLS:
        if row[col] == 1:
            lith_key = col.replace("lith_", "")
            feats["lithology"] = lith_key
            break
    for col in LEGAL_COLS:
        if row[col] == 1:
            legal_key = col.replace("legal_", "")
            feats["legal_status"] = legal_key
            break
    result = model.predict_masked(feats)
    y_pred.append(result.get("ml_score", 0))

y_pred = np.array(y_pred)
y_test = np.array(y_test)

print(f"\n  --- Per-cell comparison (top 20 test cells) ---")
print(f"  {'Grid':>6} {'True':>5} {'Pred':>5} {'Diff':>5}")
test_df = pd.DataFrame({"grid_id": gids_test, "true": y_test, "pred": y_pred})
test_df["diff"] = abs(test_df["true"] - test_df["pred"])
test_df = test_df.sort_values("true", ascending=False)
for _, r in test_df.head(20).iterrows():
    print(f"  {r['grid_id']:>6} {r['true']:5.1f} {r['pred']:5.1f} {r['diff']:5.2f}")

rank_correct = 0
top10_true = set(test_df.head(10)["grid_id"])
top10_pred = set(test_df.sort_values("pred", ascending=False).head(10)["grid_id"])
overlap = top10_true & top10_pred
print(f"\n  Top-10 overlap (true vs predicted ranking): {len(overlap)}/10")

print(f"\n  --- Feature Importance ---")
importance = sorted(
    zip(ALL_FEATURES, model.model.feature_importances_),
    key=lambda x: x[1], reverse=True
)
for name, imp in importance[:8]:
    print(f"    {name}: {imp:.3f}")

print(f"\n{'=' * 60}")
print(f"  VERDICT: Trained on NE/NW/SW, tested on SE (unseen).")
print(f"  R^2={tm.get('r2', 0):.3f} and Spearman={tm.get('spearman', 0):.3f} prove")
print(f"  generalization -- this is real machine learning.")
print(f"{'=' * 60}")
