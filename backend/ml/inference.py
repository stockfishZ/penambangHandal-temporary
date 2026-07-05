import os
import numpy as np
import joblib
from xgboost import XGBRegressor

MODEL_DIR = os.path.dirname(__file__)
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

LITH_MAP = {
    "alluvium": "lith_alluvium", "andesite": "lith_andesite",
    "lahar_deposit": "lith_lahar_deposit",
    "mafic_volcanic_simulated": "lith_mafic_volcanic_simulated",
    "peridotite_simulated": "lith_peridotite_simulated",
    "serpentinite_simulated": "lith_serpentinite_simulated",
    "tuff": "lith_tuff", "ultramafic_simulated": "lith_ultramafic_simulated",
    "volcanic_breccia": "lith_volcanic_breccia",
}

LEGAL_MAP = {
    "allowed": "legal_allowed",
    "conditional": "legal_conditional",
    "no-go": "legal_no_go",
    "no_go": "legal_no_go",
}

class ProspectivityModel:
    def __init__(self, model_path: str = MODEL_PATH):
        self.model: XGBRegressor | None = None
        self.loaded = False
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
            self.loaded = True

    def predict_masked(self, features: dict) -> dict:
        dist_road = features.get("distance_to_road_m", 9999)
        legal_status = features.get("legal_status", "unknown")

        if legal_status in ("no-go", "no_go"):
            return {"ml_score": 0.0, "masked": True, "block_reason": "Legal status: no-go zone"}
        if dist_road < 500:
            return {"ml_score": 0.0, "masked": True, "block_reason": "Distance to road < 500m (Permen LH 4/2012 penalty zone)"}

        if not self.loaded:
            return {"ml_score": None, "error": "Model not loaded", "masked": False}

        vector = self._to_vector(features)
        score = float(self.model.predict(vector.reshape(1, -1))[0])
        score = max(0.0, min(10.0, score))

        importance = self._feature_importance(vector)
        return {"ml_score": round(score, 2), "masked": False, "top_features": importance[:5]}

    def _to_vector(self, features: dict) -> np.ndarray:
        vec = []
        for col in ALL_FEATURES:
            if col in FEATURE_COLS:
                vec.append(float(features.get(col, 0.0)))
            elif col in LITH_COLS:
                lith = str(features.get("lithology", ""))
                vec.append(1.0 if LITH_MAP.get(lith) == col else 0.0)
            elif col in LEGAL_COLS:
                legal = str(features.get("legal_status", ""))
                vec.append(1.0 if LEGAL_MAP.get(legal) == col else 0.0)
            else:
                vec.append(0.0)
        return np.array(vec, dtype=np.float32)

    def _feature_importance(self, vector: np.ndarray) -> list[dict]:
        if not hasattr(self.model, "feature_importances_"):
            return []
        base = float(self.model.predict(vector.reshape(1, -1))[0])
        result = []
        for i, col in enumerate(ALL_FEATURES):
            imp = float(self.model.feature_importances_[i])
            if imp > 0.01:
                perturbed = vector.copy()
                perturbed[i] = 1.0 - perturbed[i]
                diff = abs(base - float(self.model.predict(perturbed.reshape(1, -1))[0]))
                result.append({"feature": col, "importance": round(imp, 4), "impact": round(diff, 3)})
        result.sort(key=lambda x: x["importance"], reverse=True)
        return result
