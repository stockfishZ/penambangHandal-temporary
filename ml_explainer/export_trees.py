import os
import json
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "backend", "ml", "model.pkl")
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trees_data.json")

FEATURE_NAME_MAP = {
    "f0": "slope_deg",
    "f1": "distance_to_river_m",
    "f2": "distance_to_road_m",
    "f3": "distance_to_smelter_km",
    "f4": "area_ha",
    "f5": "lith_alluvium",
    "f6": "lith_andesite",
    "f7": "lith_lahar_deposit",
    "f8": "lith_mafic_volcanic_simulated",
    "f9": "lith_peridotite_simulated",
    "f10": "lith_serpentinite_simulated",
    "f11": "lith_tuff",
    "f12": "lith_ultramafic_simulated",
    "f13": "lith_volcanic_breccia",
    "f14": "legal_allowed",
    "f15": "legal_conditional",
    "f16": "legal_no_go",
}

FEATURE_HUMAN_LABELS = {
    "slope_deg": "Kemiringan Lereng (Slope °)",
    "distance_to_river_m": "Jarak ke Sungai (m)",
    "distance_to_road_m": "Jarak ke Jalan (m)",
    "distance_to_smelter_km": "Jarak ke Smelter (km)",
    "area_ha": "Luas Area (ha)",
    "lith_alluvium": "Litologi: Alluvium",
    "lith_andesite": "Litologi: Andesite",
    "lith_lahar_deposit": "Litologi: Lahar Deposit",
    "lith_mafic_volcanic_simulated": "Litologi: Mafic Volcanic",
    "lith_peridotite_simulated": "Litologi: Peridotite (Ultramafic)",
    "lith_serpentinite_simulated": "Litologi: Serpentinite",
    "lith_tuff": "Litologi: Tuff",
    "lith_ultramafic_simulated": "Litologi: Ultramafic",
    "lith_volcanic_breccia": "Litologi: Volcanic Breccia",
    "legal_allowed": "Legal: Allowed (APL/IUP)",
    "legal_conditional": "Legal: Conditional (Hutan Produksi)",
    "legal_no_go": "Legal: No-Go (Hutan Lindung)",
}

def transform_node(node):
    if "leaf" in node:
        return {
            "nodeid": node["nodeid"],
            "leaf": round(node["leaf"], 4)
        }
    
    raw_feature = node.get("split", "")
    feat_key = FEATURE_NAME_MAP.get(raw_feature, raw_feature)
    feat_human = FEATURE_HUMAN_LABELS.get(feat_key, feat_key)

    transformed = {
        "nodeid": node["nodeid"],
        "depth": node.get("depth", 0),
        "split_feature": feat_key,
        "split_label": feat_human,
        "split_condition": node.get("split_condition", 0),
        "yes": node.get("yes"),
        "no": node.get("no"),
        "children": [transform_node(child) for child in node.get("children", [])]
    }
    return transformed

def export_trees():
    if not os.path.exists(MODEL_PATH):
        print("Model pkl not found at:", MODEL_PATH)
        return

    print("Loading XGBoost model from:", MODEL_PATH)
    model = joblib.load(MODEL_PATH)
    booster = model.get_booster()
    dump = booster.get_dump(dump_format="json")

    print(f"Total decision trees in model: {len(dump)}")
    
    parsed_trees = []
    for i, raw_json in enumerate(dump[:15]): # Export first 15 trees for interactive exploration
        tree_obj = json.loads(raw_json)
        transformed_tree = transform_node(tree_obj)
        parsed_trees.append({
            "tree_index": i,
            "tree": transformed_tree
        })

    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(parsed_trees, f, indent=2)

    print(f"Successfully exported {len(parsed_trees)} decision trees to: {OUTPUT_JSON_PATH}")

if __name__ == "__main__":
    export_trees()
