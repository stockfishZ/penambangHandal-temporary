# 🚀 NiTERRA v2.0: Finalist Action Plan & Technical Upgrade Guide
> **ANTAM Hackathon 2026 — Young Mining Innovators**  
> **Target:** Top 10 Finalist Sprint, 15-Slide Deck, Video Pitch & Demo Day Victory (Juara 1 & Golden Ticket)

---

## 📌 Executive Summary
This document serves as the master technical blueprint and action plan for **NiTERRA v2.0**. It incorporates critical feedback from senior mining geologists and industry audits to transform the initial proposal into an unassailable, geologically bulletproof, and economically compelling solution for the final judging panel at PT ANTAM (Persero) Tbk - Unit Geomin.

---

## 🛠️ 1. Technical Corrections & Geological Reframing

### 1.1 Formula & Mathematical Corrections
* **Fix TMI Equation in Code & Docs:**
  Replace any loss of exponents/formatting ($Bx2+By2+Bz2$) with the exact 3D vector norm formula:
  $$\text{TMI} = \sqrt{B_x^2 + B_y^2 + B_z^2}$$
* **Geophysical Processing:** Implement standard diurnal variation correction and high-pass/low-pass filtering algorithms in Python script (`scipy.signal` / `harmonics`) to isolate residual magnetic anomalies from regional magnetic trends.

### 1.2 Repositioning Geomagnetic (TMI) Data
* **Geological Principle:** Magnetics measures parent ultramafic bedrock (peridotite, dunite, serpentinite) and structural faults, **NOT** residual chemical nickel concentration directly.
* **Pitch & Doc Reframing:** Position TMI strictly as **"Geofisika Struktur & Delineasi Batuan Induk"** (Structural Geophysics & Ultramafic Bedrock Delineation).
* **Role in Model:** TMI identifies fault lineaments (pathways for tropical weathering water) and serpentinization boundaries, providing structural constraints for the Machine Learning model.

### 1.3 Multi-Index Remote Sensing Upgrade
Integrate three explicit spectral indices into the spatial dataset pipeline (using Sentinel-2 / Landsat 8-9 open data):
1. **Iron Oxide Index ($\text{Fe}^{3+}$ / Goethite / Hematite):**
   * *Formula:* $\text{Band Ratio} = \frac{\text{B4 (Red)}}{\text{B2 (Blue)}}$
   * *Purpose:* Direct mapping of iron-rich limonite capping crusts over nickel laterite profiles.
2. **Clay / Hydroxide Index (Serpentine / Kaolinite / Smectite):**
   * *Formula:* $\text{Band Ratio} = \frac{\text{B11 (SWIR-1)}}{\text{B12 (SWIR-2)}}$ or $\frac{\text{SWIR}}{\text{NIR}}$
   * *Purpose:* Delineation of weathering intensity and clay/saprolite mineral formation.
3. **NDVI Vegetation Stress Index:**
   * *Formula:* $\text{NDVI} = \frac{\text{B8 (NIR)} - \text{B4 (Red)}}{\text{B8 (NIR)} + \text{B4 (Red)}}$
   * *Purpose:* Detection of heavy-metal stress in vegetation cover and localization of hyperaccumulator plant habitats on ultramafic soils.

### 1.4 Hardware Upgrade Roadmap (Proof-of-Concept to Production)
* **Current PoC:** ESP32 + LSM303 (12-bit MEMS) + GPS NEO-6M + MicroSD logging.
* **Production Pitch Upgrade:** Acknowledge LSM303 as a low-cost IoT proof-of-concept. Outline transition to a **3-Axis Fluxgate Magnetometer** or **Miniaturized Rubidium Vapor Magnetometer** mounted on a 1.5m rigid non-magnetic carbon fiber boom (or towed bird) to isolate sensor payload from drone motor EMI (Electric Motor Interference).

### 1.5 KCMI 2017 / JORC Compliance Reframing
* Clarify that Machine Learning prospectivity scoring and drill spacing recommendations (expanding grid to 100m) apply **EXCLUSIVELY to Stage 1 Exploration (Scout / Prospecting Drilling)** to reduce blank holes.
* Reiterate that Stage 2 Resource Delineation (Indicated/Measured KCMI classification) strictly adheres to mandatory regulatory drill grids ($25\text{m} \times 25\text{m}$ to $50\text{m} \times 50\text{m}$).

---

## 💻 2. Software & WebGIS Code Enhancements

### 2.1 Feature Importance & Model Retraining Pipeline
Update the `XGBoost` Regressor feature inputs and target weighting structure:

```python
# Expanded Feature Matrix for XGBoost Pipeline
feature_matrix = [
    'fe_oxide_index',      # Sentinel-2 B4/B2 (Limonite Cap)
    'clay_index',          # Sentinel-2 B11/B12 (Saprolite/Weathering)
    'ndvi_stress_index',   # Sentinel-2 NIR/Red (Ultramafic Flora)
    'tmi_structural_line', # UAV Magnetometer Structural Faults
    'dem_slope_deg',       # Slope angle (Weathering Retention Zone)
    'elevation_mdpl',      # Terrain Elevation
    'dist_to_drainage',    # Hydrological leaching factor
    'geochem_assay_ratio'  # Historical SiO2/MgO & Fe/Ni ratios
]
```

### 2.2 WebGIS UI/UX Additions
* **Layer Toggles:** Add explicit interactive layer toggles in the Leaflet 2D viewer:
  * `[x] Limonite Cap (Fe-Oxide Index)`
  * `[x] Serpentine/Clay Index`
  * `[x] NDVI Vegetation Stress`
  * `[x] Structural Magnetic Lineaments (TMI)`
  * `[x] No-Go Zone Masking (Hutan Lindung)`
* **3D DEM Terrain Overlay:** Render color-coded prospectivity heatmap directly onto the WebGL 3D terrain mesh to show slope-prospectivity correlation.
* **PPKH & ESG Drafter:** Ensure "Download Draft PPKH Document (.docx/.pdf)" button generates a pre-formatted legal compliance template.

---

## 📊 3. Master 15-Slide Pitch Deck Structure (Demo Day)

| Slide # | Slide Title | Core Message & Visual Focus |
| :---: | :--- | :--- |
| **1** | **Title & Executive Summary** | *NiTERRA: AI & UAV-Guided Target Generation System for Nickel Laterite.* Clean, modern dark-theme branding. |
| **2** | **Problem Statement** | High exploration sunk costs ($1-3M/campaign), low greenfield hit rates (~1%), and rugged tropical rainforest access. |
| **3** | **The NiTERRA Solution** | Integrated decision support system: Drone Magnetometry + Satellite Multi-Index + XGBoost ML + WebGIS. |
| **4** | **Hardware Innovation** | ESP32 IoT Payload (LSM303 PoC) & Upgrade Roadmap (Fluxgate sensor on 1.5m rigid boom to negate drone EMI). |
| **5** | **Remote Sensing Geology** | Direct surface mapping via **Fe-Oxide Index (B4/B2)**, **Clay Index (B11/B12)**, and **NDVI Vegetation Stress**. |
| **6** | **Structural Geophysics** | TMI Anomaly Mapping for Ultramafic Parent Bedrock & Fault Lineament Delineation. |
| **7** | **Machine Learning Engine** | XGBoost with **Spatial Block Hold-Out Cross-Validation** ($R^2=0.842$, Spearman $\rho=0.885$) & Explainable AI (SHAP weights). |
| **8** | **Interactive WebGIS & 3D DEM** | Live screenshot & demo highlight of 2D Leaflet Prospectivity & 3D WebGL Terrain mesh. |
| **9** | **ESG & Legal Protection** | Zero-tolerance No-Go Zone masking (Hutan Lindung / Wallacea) & automated PPKH draft generator. |
| **10** | **Economic Impact & ROI** | Reduction in target generation phase time (<1 day processing) & reduction of blank drill holes. |
| **11** | **KCMI Code & Operational Flow** | Integration into Geologist workflow; compliance with KCMI 2017 scout drilling standards. |
| **12** | **Resource & Implementation Requirements** | Hardware, open-source tech stack (Python, Leaflet, PostgreSQL), and multidisciplinary team (Mining, Geophysics, Electrical). |
| **13** | **Implementation Roadmap** | 4-Phase rollout plan: Prototype refinement -> Pilot project -> Industrial validation -> Full deployment. |
| **14** | **Competitive Advantage** | Benchmarking vs KoBold Metals & SensOre: Tailored specifically for Indonesian tropical laterites. |
| **15** | **Conclusion & Call to Action** | Ready for pilot validation with PT ANTAM Geomin. Live Demo Link & Q&A invitation. |

---

## 🎯 4. Q&A Defense Matrix for Final Presentation

Be prepared to answer tough technical questions from ANTAM Geomin judges using these pre-formulated responses:

### Q1: "Geomagnetic data is usually for gold, not nickel. Why are you using it?"
> **Defense:** *"You are 100% correct, Sir. Magnetics does not measure nickel grade directly. In NiTERRA, we do not use TMI to predict %Ni. Instead, TMI is used for **structural geophysics**—mapping the parent ultramafic bedrock boundaries and fault lineaments that govern weathering water flow. For surface mineral chemistry, we rely on Remote Sensing Fe-Oxide and Clay indices."*

### Q2: "How do you handle drone motor electromagnetic interference (EMI) on the magnetometer?"
> **Defense:** *"Our current ESP32 LSM303 setup serves as a low-cost IoT proof-of-concept. For production deployment, we utilize a 1.5-meter rigid non-magnetic carbon fiber boom to isolate the sensor beyond the motor's EMI envelope, combined with digital bandpass filtering."*

### Q3: "Does widening drill spacing to 100m violate KCMI reporting standards?"
> **Defense:** *"Not at all. AI-guided target optimization applies strictly to **Stage 1 Scout/Prospecting Drilling** to quickly locate economic pods and eliminate blank holes. Once a prospect is confirmed, Stage 2 Resource Estimation strictly follows mandatory KCMI grid densities ($25\text{m} - 50\text{m}$)."*

### Q4: "How do you prevent Spatial Overfitting in your Machine Learning model?"
> **Defense:** *"We specifically avoided naive random train-test splits. We implemented **Spatial Block Hold-Out Cross-Validation**, partitioning entire geographic regions (SE block with 200,101 grid cells) for testing. This achieved $R^2 = 0.842$ and Spearman $\rho = 0.885$, proving high spatial generalizability."*

---

## 🎬 5. Video Pitch (2-Min) Script Outline

* **[0:00 - 0:25] Hook & Problem:** Show tropical rainforest terrain in Morowali. Mention the $1–3M cost and months spent drilling blank holes in early nickel exploration.
* **[0:25 - 0:55] The Solution (NiTERRA):** Introduce NiTERRA. Show drone flying with ESP32 payload, satellite Remote Sensing (Fe-Oxide & Clay), and instant 3D WebGIS rendering.
* **[0:55 - 1:30] AI & Technical Superiority:** Demonstrate XGBoost spatial prediction, No-Go zone ESG masking, and automated PPKH drafting.
* **[1:30 - 2:00] Economic Value & Closing:** Highlight cost savings, KCMI compliance, team composition (Mining + Geophysics + Electrical ITB), and call to action for ANTAM Geomin pilot testing.

---

*NiTERRA v2.0 Master Plan — Engineered for Victory.*
