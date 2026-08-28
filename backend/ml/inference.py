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
MODEL_JSON_PATH = os.path.join(MODEL_DIR, "model.json")
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
    # Alluvium & sed
    "alluvium": "lith_alluvium",
    # Volcanics & Andesites
    "andesite": "lith_andesite",
    "lahar_deposit": "lith_lahar_deposit",
    "tuff": "lith_tuff",
    "volcanic_breccia": "lith_volcanic_breccia",
    # Mafic volcanics & intrusive
    "mafic_volcanic_simulated": "lith_mafic_volcanic_simulated",
    "mafic": "lith_mafic_volcanic_simulated",
    "gabbro_simulated": "lith_mafic_volcanic_simulated",
    "gabbro": "lith_mafic_volcanic_simulated",
    "basalt_simulated": "lith_mafic_volcanic_simulated",
    "basalt": "lith_mafic_volcanic_simulated",
    # Peridotite & ultramafic varieties
    "peridotite_simulated": "lith_peridotite_simulated",
    "peridotite": "lith_peridotite_simulated",
    "harzburgite_simulated": "lith_peridotite_simulated",
    "harzburgite": "lith_peridotite_simulated",
    "dunite_simulated": "lith_peridotite_simulated",
    "dunite": "lith_peridotite_simulated",
    "lherzolite_simulated": "lith_peridotite_simulated",
    "lherzolite": "lith_peridotite_simulated",
    "pyroxenite_simulated": "lith_peridotite_simulated",
    "pyroxenite": "lith_peridotite_simulated",
    # Serpentinite & General Ultramafic
    "serpentinite_simulated": "lith_serpentinite_simulated",
    "serpentinite": "lith_serpentinite_simulated",
    "ultramafic_simulated": "lith_ultramafic_simulated",
    "ultramafic": "lith_ultramafic_simulated",
}

LEGAL_MAP = {
    "allowed": "legal_allowed",
    "conditional": "legal_conditional",
    "no-go": "legal_no_go",
    "no_go": "legal_no_go",
    "dilarang": "legal_no_go",
}

class ProspectivityModel:
    def __init__(self, model_path: str = MODEL_PATH):
        self.model = None
        self.loaded = False
        self.metadata = {}
        self._load_model(model_path)
        if os.path.exists(META_PATH):
            try:
                with open(META_PATH, encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception:
                pass

    def _load_model(self, model_path: str = MODEL_PATH):
        if not XGB_AVAILABLE:
            return
        
        # Try fast native JSON model first (zero pickle warnings, cross-version safe)
        if os.path.exists(MODEL_JSON_PATH):
            try:
                self.model = XGBRegressor()
                self.model.load_model(MODEL_JSON_PATH)
                self.loaded = True
                return
            except Exception:
                self.model = None
                self.loaded = False

        # Fallback to pickle model
        if os.path.exists(model_path):
            try:
                self.model = joblib.load(model_path)
                self.loaded = True
                # Automatically save JSON model for future clean loading
                try:
                    self.model.save_model(MODEL_JSON_PATH)
                except Exception:
                    pass
            except Exception:
                self.model = None
                self.loaded = False

    def reload(self):
        self._load_model(MODEL_PATH)
        if os.path.exists(META_PATH):
            try:
                with open(META_PATH, encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception:
                pass

    def predict_masked(self, features: dict) -> dict:
        dist_road = features.get("distance_to_road_m", 9999)
        legal_status = str(features.get("legal_status", "unknown")).lower()
        lithology = str(features.get("lithology", "unknown")).lower()
        is_water = features.get("is_water", False) or lithology in ("air_laut", "water", "marine_water") or legal_status == "marine_water"

        if is_water:
            return {"ml_score": 0.0, "masked": True, "block_reason": "Area Perairan / Laut Terbuka (Marine Water Zone)"}

        # Block target if area is a legal no-go zone or inside road buffer
        if legal_status in ("no-go", "no_go", "dilarang"):
            return {"ml_score": 0.0, "masked": True, "block_reason": "Legal status: no-go zone"}
        if dist_road < 500:
            return {"ml_score": 0.0, "masked": True, "block_reason": "Distance to road < 500m (Permen LH 4/2012 penalty zone)"}

        # Fallback scoring if ML model file is missing
        if not self.loaded:
            legal = str(features.get("legal_status", ""))
            legal_score = 5.0 if legal == "allowed" else (3.0 if legal == "conditional" else 0.0)

            lith = str(features.get("lithology", "")).lower()
            is_ultra = any(x in lith for x in ["serpentinite", "peridotite", "ultramafic", "harzburgite", "dunite"])
            lith_score = 3.0 if is_ultra else (1.5 if "mafic" in lith or "gabbro" in lith or "basalt" in lith else 0.0)

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
        raw_score = float(self.model.predict(vector.reshape(1, -1))[0])
        # Rescale from 0-100 raw training label range to standard 0.0-10.0 index
        scaled_score = raw_score / 10.0 if raw_score > 10.0 else raw_score
        score = max(0.0, min(10.0, scaled_score))

        importance = self._feature_importance(vector)

        test_metrics = self.metadata.get("test_metrics", {})
        return {
            "ml_score": round(score, 2),
            "masked": False,
            "top_features": importance[:5],
            "ml_confidence": round(1.0 - test_metrics.get("rmse", 0.5) / 100.0, 3) if test_metrics.get("rmse", 0) > 1 else round(1.0 - test_metrics.get("rmse", 0.5) / 10.0, 3),
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
                lith = str(features.get("lithology", "")).lower()
                vec.append(1.0 if LITH_MAP.get(lith) == col else 0.0)
            elif col in LEGAL_COLS:
                legal = str(features.get("legal_status", "")).lower()
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
                if col in FEATURE_COLS:
                    # 10% reduction sensitivity perturbation for continuous geospatial variables
                    perturbed[i] = perturbed[i] * 0.9
                else:
                    # Binary toggle for one-hot encoded geological and legal classes
                    perturbed[i] = 1.0 - perturbed[i]
                
                perturbed_val = float(self.model.predict(perturbed.reshape(1, -1))[0])
                diff = abs(base - perturbed_val)
                # Rescale impact to 0-10 scale if base is on 0-100 scale
                scaled_diff = diff / 10.0 if base > 10.0 else diff
                result.append({"feature": col, "importance": round(imp, 4), "impact": round(scaled_diff, 3)})
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
