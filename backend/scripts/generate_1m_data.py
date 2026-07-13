import os
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

def generate_1m_data():
    num_samples = 1000000
    
    # Grid IDs
    grid_ids = [f"G{i:07d}" for i in range(num_samples)]
    
    # Regions
    regions = ["NW", "NE", "SW", "SE", "C"]
    region_ids = np.random.choice(regions, size=num_samples)
    
    # Features
    slope_deg = np.random.uniform(0, 45, num_samples)
    distance_to_river_m = np.random.uniform(10, 2000, num_samples)
    distance_to_road_m = np.random.uniform(10, 5000, num_samples)
    distance_to_smelter_km = np.random.uniform(5, 200, num_samples)
    area_ha = np.random.uniform(10, 300, num_samples)
    
    # Lithology
    lith_types = [
        "lith_alluvium", "lith_andesite", "lith_lahar_deposit",
        "lith_mafic_volcanic_simulated", "lith_peridotite_simulated",
        "lith_serpentinite_simulated", "lith_tuff",
        "lith_ultramafic_simulated", "lith_volcanic_breccia"
    ]
    # Make ultramafic more common to reflect nickel belts
    p_lith = [0.05, 0.05, 0.05, 0.1, 0.2, 0.2, 0.05, 0.25, 0.05]
    chosen_lith = np.random.choice(len(lith_types), size=num_samples, p=p_lith)
    
    lith_cols = np.zeros((num_samples, len(lith_types)), dtype=int)
    lith_cols[np.arange(num_samples), chosen_lith] = 1
    
    # Legal status (Based on research: ~20% allowed, 60% conditional, 20% no_go)
    legal_probs = [0.20, 0.60, 0.20]
    chosen_legal = np.random.choice(3, size=num_samples, p=legal_probs)
    legal_cols = np.zeros((num_samples, 3), dtype=int)
    legal_cols[np.arange(num_samples), chosen_legal] = 1
    
    # Dataframes
    df_features = pd.DataFrame({
        "grid_id": grid_ids,
        "region_id": region_ids,
        "slope_deg": slope_deg,
        "distance_to_river_m": distance_to_river_m,
        "distance_to_road_m": distance_to_road_m,
        "distance_to_smelter_km": distance_to_smelter_km,
        "area_ha": area_ha,
    })
    
    for i, col in enumerate(lith_types):
        df_features[col] = lith_cols[:, i]
        
    df_features["legal_allowed"] = legal_cols[:, 0]
    df_features["legal_conditional"] = legal_cols[:, 1]
    df_features["legal_no_go"] = legal_cols[:, 2]
    
    # Calculate target: prospectivity_score
    # Max score 100
    # Good lithology adds up to 50
    # Legal allowed adds 20, conditional adds 15, no-go is 0 (or masked later)
    # Slope adds up to 10
    # Road access adds up to 10
    # River adds up to 10
    
    score = np.zeros(num_samples)
    
    # Lithology scores
    lith_score_map = {
        "lith_ultramafic_simulated": 50,
        "lith_peridotite_simulated": 45,
        "lith_serpentinite_simulated": 48,
        "lith_mafic_volcanic_simulated": 20,
    }
    for i, col in enumerate(lith_types):
        val = lith_score_map.get(col, 5)
        score += df_features[col] * val
        
    # Legal scores
    score += df_features["legal_allowed"] * 20
    score += df_features["legal_conditional"] * 15
    score += df_features["legal_no_go"] * 0
    
    # Slope scores
    score += np.maximum(0, 10 - (slope_deg / 45) * 10)
    
    # Road access score
    score += np.maximum(0, 10 - (distance_to_road_m / 5000) * 10)
    
    # River score (prefer slightly away from river, say optimal > 200m)
    # Let's just say closer to 1000m is better, close to 0 is bad
    river_score = np.where(distance_to_river_m < 200, 2, 10)
    score += river_score
    
    # Add noise
    score += np.random.normal(0, 2, num_samples)
    score = np.clip(score, 0, 100)
    
    df_labels = pd.DataFrame({
        "grid_id": grid_ids,
        "prospectivity_score": score
    })
    
    print("Saving features...")
    df_features.to_csv(os.path.join(DATA_DIR, "training_features.csv"), index=False)
    print("Saving labels...")
    df_labels.to_csv(os.path.join(DATA_DIR, "expert_labels.csv"), index=False)
    print("Done generating 1M records.")

if __name__ == "__main__":
    generate_1m_data()
