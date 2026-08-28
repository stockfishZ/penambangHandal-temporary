import os, json, math
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from scipy.stats import spearmanr
from xgboost import XGBRegressor
import joblib

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
MODEL_DIR = os.path.dirname(__file__)

FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")
HIDDEN_CSV = os.path.join(DATA_DIR, "hidden_truth.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
MODEL_JSON_PATH = os.path.join(MODEL_DIR, "model.json")
META_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

FEATURE_COLS = [
    "slope_deg", "distance_to_river_m", "distance_to_road_m",
    "distance_to_smelter_km", "area_ha",
]

LITH_COLS = [
    "lith_alluvium", "lith_andesite", "lith_lahar_deposit",
    "lith_mafic_volcanic_simulated", "lith_peridotite_simulated",
    "lith_serpentinite_simulated", "lith_tuff",
    "lith_ultramafic_simulated", "lith_volcanic_breccia",
]

LEGAL_COLS = ["legal_allowed", "legal_conditional", "legal_no_go"]

ALL_FEATURES = FEATURE_COLS + LITH_COLS + LEGAL_COLS


def load_data():
    X_df = pd.read_csv(FEATURES_CSV)
    y_df = pd.read_csv(LABELS_CSV)

    missing = [c for c in ALL_FEATURES if c not in X_df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")

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

    print(f"Loaded {len(X)} samples, {len(ALL_FEATURES)} features")
    print(f"  Regions: {sorted(set(region_ids))}")
    for r in sorted(set(region_ids)):
        print(f"    {r}: {(region_ids == r).sum()} cells")
    if len(y):
        print(f"  Label range: {y.min():.1f} – {y.max():.1f}")
    return X, y, region_ids, grid_ids


def spatial_split(X, y, region_ids, test_regions=("SE",)):
    test_mask = np.array([r in test_regions for r in region_ids])
    train_mask = ~test_mask
    return (X[train_mask], X[test_mask],
            y[train_mask], y[test_mask])


def evaluate(y_true, y_pred, label="Test"):
    rmse = math.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    rho, _ = spearmanr(y_true, y_pred)
    print(f"  {label}: RMSE={rmse:.3f}, MAE={mae:.3f}, R^2={r2:.3f}, Spearman={rho:.3f}")
    return {"rmse": rmse, "mae": mae, "r2": r2, "spearman": rho}


def train_model(X, y, region_ids):
    X_train, X_test, y_train, y_test = spatial_split(X, y, region_ids, test_regions=("SE",))
    print(f"\nTrain: {len(X_train)} cells, Test (SE region): {len(X_test)} cells")

    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)

    print(f"\n--- Model Performance ---")
    train_metrics = evaluate(y_train, y_train_pred, "Train")
    test_metrics = evaluate(y_test, y_test_pred, "Test (spatial holdout)")

    print(f"\n--- Feature Importance (top 10) ---")
    importance = sorted(
        zip(ALL_FEATURES, model.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    for name, imp in importance[:10]:
        print(f"  {name}: {imp:.4f}")

    model.fit(X, y)
    
    # Save native XGBoost JSON model
    tmp_json_path = MODEL_JSON_PATH + ".tmp"
    model.save_model(tmp_json_path)
    os.replace(tmp_json_path, MODEL_JSON_PATH)

    # Save pickle model for legacy support
    tmp_model_path = MODEL_PATH + ".tmp"
    joblib.dump(model, tmp_model_path)
    os.replace(tmp_model_path, MODEL_PATH)

    metadata = {
        "features": ALL_FEATURES,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "test_regions": ["SE"],
        "train_regions": sorted(set(region_ids) - {"SE"}),
        "train_metrics": train_metrics,
        "test_metrics": test_metrics,
        "n_features": len(ALL_FEATURES),
    }
    tmp_meta_path = META_PATH + ".tmp"
    with open(tmp_meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    os.replace(tmp_meta_path, META_PATH)

    print(f"\nModel saved: {MODEL_PATH}")
    print(f"Metadata saved: {META_PATH}")
    return model


if __name__ == "__main__":
    X, y, region_ids, grid_ids = load_data()
    train_model(X.values, y.values, region_ids)
