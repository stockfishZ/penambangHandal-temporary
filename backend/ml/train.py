import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from xgboost import XGBRegressor
import joblib

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
MODEL_DIR = os.path.dirname(__file__)

FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")
LABELS_CSV = os.path.join(DATA_DIR, "expert_labels.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")

FEATURE_COLS = [
    "slope_deg", "distance_to_river_m", "distance_to_road_m",
    "distance_to_smelter_km", "area_ha",
    "Ni_pct_mean", "Fe_pct_mean", "Co_pct_mean", "MgO_pct_mean", "SiO2_pct_mean",
    "mag_mean_nT", "mag_std_nT",
]

LITH_COLS = [
    "lith_alluvium", "lith_andesite", "lith_lahar_deposit",
    "lith_mafic_volcanic_simulated", "lith_peridotite_simulated",
    "lith_serpentinite_simulated", "lith_tuff",
    "lith_ultramafic_simulated", "lith_volcanic_breccia",
]

LEGAL_COLS = ["legal_allowed", "legal_conditional", "legal_no_go"]

ALL_FEATURES = FEATURE_COLS + LITH_COLS + LEGAL_COLS

def load_training_data(
    features_path: str = FEATURES_CSV,
    labels_path: str = LABELS_CSV,
) -> tuple[pd.DataFrame, pd.Series]:
    X = pd.read_csv(features_path)
    y_df = pd.read_csv(labels_path)

    missing = [c for c in ALL_FEATURES if c not in X.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")

    X = X[ALL_FEATURES]
    y = y_df["prospectivity_score"]

    mask = y.notna()
    X, y = X[mask].reset_index(drop=True), y[mask].reset_index(drop=True)

    print(f"Loaded {len(X)} samples (filtered from {len(mask)} total, {mask.sum()} scored, {(~mask).sum()} blocked), {len(ALL_FEATURES)} features")
    if len(y):
        print(f"Label range: {y.min():.1f} – {y.max():.1f}")
    return X, y

def train_model(X, y, model_path: str = MODEL_PATH) -> XGBRegressor:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

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

    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=cv, scoring="r2")

    print(f"\n--- Model Performance ---")
    print(f"RMSE:  {rmse:.3f}")
    print(f"MAE:   {mae:.3f}")
    print(f"R²:    {r2:.3f}")
    print(f"CV R²: {cv_scores.mean():.3f} (±{cv_scores.std():.3f})")

    print(f"\n--- Feature Importance (top 10) ---")
    importance = sorted(
        zip(ALL_FEATURES, model.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    for name, imp in importance[:10]:
        print(f"  {name}: {imp:.4f}")

    model.fit(X, y)
    joblib.dump(model, model_path)
    print(f"\nModel saved: {model_path}")
    return model

if __name__ == "__main__":
    X, y = load_training_data()
    train_model(X, y)
