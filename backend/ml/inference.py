import os, json
import numpy as np

try:
    import joblib
    from xgboost import XGBRegressor
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    XGBRegressor = None

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
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
        self.model = None
        self.loaded = False
        self.metadata = {}
        if XGB_AVAILABLE and os.path.exists(model_path):
            try:
                self.model = joblib.load(model_path)
                self.loaded = True
            except Exception:
                self.loaded = False
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                self.metadata = json.load(f)

    def reload(self):
        if XGB_AVAILABLE and os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                self.loaded = True
            except Exception:
                self.loaded = False
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                self.metadata = json.load(f)

    def predict_masked(self, features: dict) -> dict:
        dist_road = features.get("distance_to_road_m", 9999)
        legal_status = features.get("legal_status", "unknown")

        # Block target if area is a legal no-go zone or inside road buffer
        if legal_status in ("no-go", "no_go"):
            return {"ml_score": 0.0, "masked": True, "block_reason": "Legal status: no-go zone"}
        if dist_road < 500:
            return {"ml_score": 0.0, "masked": True, "block_reason": "Distance to road < 500m (Permen LH 4/2012 penalty zone)"}

        # Fallback scoring if ML model file is missing
        if not self.loaded:
            legal = str(features.get("legal_status", ""))
            legal_score = 5.0 if legal == "allowed" else (3.0 if legal == "conditional" else 0.0)

            lith = str(features.get("lithology", ""))
            is_ultra = any(x in lith for x in ["serpentinite", "peridotite", "ultramafic"])
            lith_score = 3.0 if is_ultra else (1.5 if "mafic" in lith else 0.0)

            slope = float(features.get("slope_deg", 0.0))
            slope_norm = max(0.0, (15.0 - abs(slope - 8.0)) / 15.0)

            road_km = float(features.get("distance_to_road_m", 9999)) / 1000.0
            road_score = max(0.0, 1.0 - abs(road_km - 2.5) / 7.5) if road_km <= 10 else 0.0

            smelter = float(features.get("distance_to_smelter_km", 999))
            smelter_score = max(0.0, 1.0 - smelter / 150.0)

            score = legal_score + lith_score + slope_norm + road_score + smelter_score
            score = round(max(0.0, min(10.0, score)), 2)

            importance = [
                {"feature": "legal_status", "importance": 0.40, "impact": round(legal_score, 3)},
                {"feature": "lithology", "importance": 0.30, "impact": round(lith_score, 3)},
                {"feature": "slope_deg", "importance": 0.12, "impact": round(slope_norm, 3)},
                {"feature": "distance_to_road_m", "importance": 0.10, "impact": round(road_score, 3)},
                {"feature": "distance_to_smelter_km", "importance": 0.08, "impact": round(smelter_score, 3)},
            ]
            return {
                "ml_score": score,
                "masked": False,
                "top_features": importance,
                "ml_confidence": 0.60,
                "ml_cv_score": 0.55,
                "fallback": True
            }

        # Predict target prospectivity using trained XGBoost model
        vector = self._to_vector(features)
        score = float(self.model.predict(vector.reshape(1, -1))[0])
        score = max(0.0, min(10.0, score))

        importance = self._feature_importance(vector)

        test_metrics = self.metadata.get("test_metrics", {})
        return {
            "ml_score": round(score, 2),
            "masked": False,
            "top_features": importance[:5],
            "ml_confidence": round(1.0 - test_metrics.get("rmse", 0.5) / 10.0, 3),
            "ml_cv_score": test_metrics.get("r2", 0),
        }

    def get_model_info(self) -> dict:
        if not self.loaded:
            return {"loaded": False, "error": "No model loaded"}
        return {
            "loaded": True,
            "features": ALL_FEATURES,
            "n_features": len(ALL_FEATURES),
            "metadata": self.metadata,
        }

    # Convert input dict to feature vector for ML model
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

    # Calculate feature importance for explainable AI (XAI)
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

if __name__ == "__main__":
    m = ProspectivityModel()
    test_feats = {
        "slope_deg": 10.0,
        "distance_to_river_m": 200.0,
        "distance_to_road_m": 1200.0,
        "distance_to_smelter_km": 45.0,
        "area_ha": 10.0,
        "Ni_pct_mean": 1.2,
        "Fe_pct_mean": 15.0,
        "Co_pct_mean": 0.08,
        "MgO_pct_mean": 22.0,
        "SiO2_pct_mean": 38.0,
        "mag_mean_nT": 50.0,
        "mag_std_nT": 5.0,
        "lithology": "peridotite_simulated",
        "legal_status": "allowed"
    }
    res = m.predict_masked(test_feats)
    print("Normal Inference Result:", res)
    assert res["ml_score"] > 0
    assert not res["masked"]
    
    test_feats["legal_status"] = "no-go"
    res_masked = m.predict_masked(test_feats)
    print("Masked Inference Result:", res_masked)
    assert res_masked["ml_score"] == 0.0
    assert res_masked["masked"]
    
    m.loaded = False
    test_feats["legal_status"] = "allowed"
    res_fallback = m.predict_masked(test_feats)
    print("Fallback Inference Result:", res_fallback)
    assert res_fallback["ml_score"] > 0
    assert res_fallback.get("fallback") is True
    print("Self-check passed successfully!")
