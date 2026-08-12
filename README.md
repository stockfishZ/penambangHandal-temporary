# 🚀 NiTERRA v2.0 — Next-Gen Nickel Exploration Target & Risk Analytics

[![Hackathon](https://img.shields.io/badge/ANTAM%20Hackathon-2026%20Finalist-gold?style=for-the-badge&logo=trophy)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/FINALIST_ACTION_PLAN.md)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/main.py)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0-111111?style=for-the-badge&logo=xgboost)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/index.html)
[![WebGL](https://img.shields.io/badge/WebGL-3D%20Mesh-990000?style=for-the-badge&logo=webgl&logoColor=white)](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/terrain-analysis.html)

> **ANTAM Hackathon 2026 — Young Mining Innovators (Top 10 Finalist)**  
> Developed by **Tim Penambang Handal (Institut Teknologi Bandung)**:
> - **Lian Ridzuan** *(Teknik Pertambangan)* — Mining Economics & Domain Expert
> - **Rafa Satria Pratama** *(Teknik Elektro)* — Embedded IoT Firmware & Backend ML Engineering
> - **Kevin Yuhan Wahyu Pratama** *(Teknik Geofisika)* — Geophysical Data Processing & 2D/3D WebGIS

---

## 📌 Table of Contents
1. [Executive Summary & Problem Statement](#-executive-summary--problem-statement)
2. [The NiTERRA Solution](#-the-niterra-solution)
3. [Key Features](#-key-features)
4. [System Architecture & Data Flow](#-system-architecture--data-flow)
5. [Repository Directory Structure](#-repository-directory-structure)
6. [Technology Stack](#-technology-stack)
7. [Installation & Quick Start (0 to 100 Guide)](#-installation--quick-start-0-to-100-guide)
8. [API Documentation](#-api-documentation)
9. [Hardware Payload Integration](#-hardware-payload-integration)
10. [Documentation & Quick Links](#-documentation--quick-links)

---

## 💡 Executive Summary & Problem Statement

### 🔴 The Industry Problem: Blind Drilling Sunk Costs
In greenfield nickel laterite exploration across Sulawesi and Halmahera (Indonesia), conventional methods rely heavily on **blind grid drilling**. 
- 💸 **Extremely Expensive:** Drilling costs average **~Rp 1,000,000 / meter**.
- ❌ **Low Hit Rate:** Up to **99 out of 100 exploration drill holes turn out sterile (dry holes)** due to complex tropical weathering mantles.
- ⏳ **Time Consuming:** Manual data processing takes weeks to months.
- ⚠️ **Legal & Environmental Risk:** Drilling near protected forest zones (Hutan Lindung) or river buffers risks severe regulatory fines and environmental degradation.

### 🟢 The NiTERRA Solution: AI Target Generation + ESG Safety Net
**NiTERRA v2.0** acts as a **"Smart X-Ray & AI Navigation System"** for mining exploration teams:
- 🎯 **Hit Rate Boost:** Increases drilling accuracy from **~1% up to >40%**.
- ⏱️ **Instant Target Generation:** Reduces target area screening time from **weeks to minutes**.
- 💰 **Massive Cost Savings:** Saves hundreds of millions to billions of Rupiah by eliminating sterile drill holes.
- 🛡️ **Automated ESG Compliance:** Automatically enforces Permen LHK 4/2021 & Kepmen ESDM 1827 K rules, locking "No-Go" zones and auto-generating PPKH compliance drafts.

---

## ⭐ Key Features

1. **🛰️ Satellite Remote Sensing (Sentinel-2 Integration):**
   - Spectral Band Ratio Analysis (Fe-Oxide / Limonite and Saprolite Clay mapping).
   - Land surface temperature and vegetation coverage filtering.

2. **🛸 Drone Magnetometer Payload (ESP32 Custom Hardware):**
   - High-rate geomagnetic Total Magnetic Intensity (TMI) data collection.
   - Real-time fault, fracture, and ultramafic bedrock structure detection without deforestation.

3. **🧠 Dual-Engine XGBoost AI Prospectivity Model:**
   - Machine learning regressor trained on pre-survey multi-source geospatial data.
   - **Explainable AI (XAI):** Generates top-5 feature contribution score breakdowns for every grid cell.

4. **🛡️ Automated ESG & Legal Safety Engine:**
   - Real-time buffer checking against KLHK forest boundaries, river/waterway buffers (50m - 500m), public roads, and settlements.
   - Automatic `viability_score` calculation and instant generation of official legal compliance document drafts.

5. **🗺️ Dual 2D & 3D Interactive WebGIS:**
   - **2D Leaflet Map:** High-performance grid heatmap, site filtering, and priority ranking.
   - **3D WebGL DEM Mesh:** Dynamic terrain visualization for slope and elevation assessment.

---

## 🏗️ System Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. DATA INGESTION TIER                                   │
├──────────────────────────┬───────────────────────────────┬───────────────────────────────┤
│   Sentinel-2 Satellites  │    Drone Magnetometer Payload │   Spatial DB & BIG One Map    │
│   (Limonite/Saprolite)   │    (ESP32 + GUI Monitor)      │   (KLHK Hutan / OSM Roads)    │
└────────────┬─────────────┴───────────────┬───────────────┴───────────────┬───────────────┘
             │                             │                               │
             └─────────────────────────────┼───────────────────────────────┘
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               2. DUAL-ENGINE PROCESSING                                  │
├──────────────────────────────────────────┬───────────────────────────────────────────────┤
│    Engine 1: Spatial & Legal Engine      │     Engine 2: Machine Learning AI Engine      │
│    - Hard Exclusion (Hutan Lindung)      │     - XGBoost Prospectivity Model             │
│    - Buffer Penalties (River / Road)     │     - One-Hot Encoded Lithology & Features    │
│    - Returns Viability Score (0.0 - 1.0) │     - Explainable AI (XAI Feature Breakdown)  │
└────────────────────────────┬─────────────┴───────────────────────────────┬───────────────┘
                             │                                             │
                             └──────────────────────┬──────────────────────┘
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 3. OUTPUT & WEBGIS TIER                                  │
├──────────────────────────────────────────┬───────────────────────────────────────────────┤
│   2D Interactive Leaflet WebGIS          │   3D WebGL DEM Mesh Viewer                    │
│   [index.html]                           │   [terrain-analysis.html]                     │
├──────────────────────────────────────────┴───────────────────────────────────────────────┤
│   Automated ESG & PPKH Legal Document Drafting Engine                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Directory Structure

```
penambangHandal-temporary/
├── README.md                           # Comprehensive GitHub Documentation
├── PROJECT_STORYLINE.md                # Full narrative & team storyline
├── BACKEND_SYSTEM_FAQ.md               # Backend system technical Q&A & architecture guide
├── FINALIST_ACTION_PLAN.md             # Finalist sprint blueprint, pitch deck & video script
├── index.html                          # 2D Interactive WebGIS Leaflet Viewer
├── terrain-analysis.html               # 3D WebGL DEM Mesh Terrain Viewer
├── new_effect.js                       # WebGIS particle & visual FX module
│
├── backend/                            # FastAPI & ML Intelligence Engine
│   ├── run.py                          # Uvicorn entry point server script
│   ├── requirements.txt                # Python dependencies
│   ├── app/                            # FastAPI Application Package
│   │   ├── main.py                     # Primary REST API endpoints & legal rules engine
│   │   ├── config.py                   # App configuration & environment settings
│   │   ├── database.py                 # PostGIS / PostgreSQL connection manager
│   │   └── big_api.py                  # Integration with BIG One Map Server API
│   ├── ml/                             # Machine Learning Module
│   │   ├── inference.py                # ProspectivityModel XGBoost inference & XAI code
│   │   ├── train.py                    # XGBoost training pipeline script
│   │   ├── features.py                 # Feature engineering helpers
│   │   ├── forward_model.py            # Forward geophysics modeling module
│   │   ├── model.pkl                   # Trained XGBoost model binary
│   │   └── model_metadata.json         # Model parameters & metadata
│   └── scripts/                        # Utility & data processing scripts
│
├── js/                                 # Frontend Javascript Modules
│   ├── app.js                          # Main WebGIS map logic & API orchestrator
│   ├── terrain-analysis.js             # 3D WebGL renderer & DEM processing
│   ├── ml-client.js                    # Client-side ML API communication wrapper
│   ├── grid-gen.js                     # Spatial grid generator helper
│   └── shared-sites.js                 # Target exploration site definitions
│
├── css/                                # Custom Design System & Utility Styles
│   ├── style.css                       # Primary styling sheet
│   └── terrain-analysis.css            # 3D Mesh viewer styling
│
├── Codingan IGL2 Magnetometer/         # Drone Hardware Payload Package
│   ├── Advanced_Geomagnetic_GUI_Magnetometer.py # Real-time Tkinter GUI telemetry viewer
│   └── (ESP32 C++ firmware code)       # Arduino / ESP32 sensor acquisition sketch
│
├── data/                               # Sample Geospatial Datasets
│   ├── GeoNiRisk_Synthesized_Dataset.csv
│   └── GeoNiRisk_Synthesized_Dataset_Validation.csv
│
└── Final Proposal/                     # Official ANTAM Hackathon Proposal Document
    └── Proposal Penambang Handal (5).md
```

---

## 🧰 Technology Stack

### **Frontend & Visualization**
- **HTML5 & CSS3:** Custom responsive layout and dark glassmorphic design system.
- **JavaScript (ES6+):** Modular asynchronous state management.
- **Leaflet.js (v1.9.4):** 2D geospatial map, heatmaps, layer toggling, vector tiles.
- **Three.js / WebGL:** Real-time 3D terrain mesh rendering from Elevation DEMs.
- **Chart.js:** Feature importance breakdown & score distribution charts.

### **Backend & Machine Learning**
- **Python 3.11:** Primary backend runtime.
- **FastAPI:** High-performance asynchronous REST API framework.
- **XGBoost:** Gradient boosted decision trees for prospectivity regression.
- **NumPy & Pandas:** Data manipulation and vector operations.
- **Joblib:** Machine learning model serialization.

### **Database & GIS Services**
- **PostgreSQL + PostGIS:** Spatial indexing, buffering, and distance calculations.
- **ArcGIS REST / BIG One Map API:** Fallback live national forestry boundary query.

### **Hardware & Embedded IoT**
- **ESP32 Microcontroller:** Hardware magnetometer sensor acquisition payload.
- **Tkinter & Serial Communication:** Python desktop GUI for live drone telemetry.

---

## ⚡ Installation & Quick Start (0 to 100 Guide)

Follow these simple steps to run the complete NiTERRA system locally on Windows, macOS, or Linux.

### 📋 Prerequisites
- **Python 3.11+** installed on your system.
- Modern web browser (Chrome, Edge, Firefox, Safari).
- *(Optional)* Git installed.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/penambangHandal-temporary.git
cd penambangHandal-temporary
```

---

### Step 2: Set Up & Run the Backend API
Navigate to the `backend/` directory, set up a virtual environment, install dependencies, and launch the FastAPI server:

#### **Windows (PowerShell / Command Prompt):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

#### **Linux / macOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

The backend server will start at:
- **API Base URL:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

---

### Step 3: Launch the 2D WebGIS Frontend
Simply open [`index.html`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/index.html) directly in your browser, or serve it using Python's built-in HTTP server:

```bash
# Run from the repository root directory:
python -m http.server 3000
```
Then visit **`http://localhost:3000`** in your browser.

---

### Step 4: Launch the 3D WebGL Terrain Viewer
Open [`terrain-analysis.html`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/terrain-analysis.html) directly in your browser or visit **`http://localhost:3000/terrain-analysis.html`**.

---

### Step 5: (Optional) Run the Hardware Magnetometer Telemetry GUI
To test the real-time drone magnetometer payload monitoring app:

```bash
python "Codingan IGL2 Magnetometer/Advanced_Geomagnetic_GUI_Magnetometer.py"
```

---

## 📡 API Documentation

NiTERRA provides clean RESTful API endpoints via FastAPI:

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `GET /` | `GET` | API Health Check and Welcome Status |
| `GET /health` | `GET` | Backend system & model loading diagnostic status |
| `POST /api/analyze-grid` | `POST` | Analyze a single target grid cell (returns prospectivity, viability score, & XAI features) |
| `POST /api/analyze-batch` | `POST` | Batch process multiple spatial grid cells in parallel |
| `POST /api/generate-esg-doc` | `POST` | Auto-generate official PPKH legal compliance document drafts |

### Example Request (`POST /api/analyze-grid`):
```json
{
  "grid_id": "GRID-SUL-042",
  "latitude": -2.5489,
  "longitude": 121.3412,
  "slope_deg": 14.5,
  "lithology": "peridotite_simulated",
  "legal_status": "allowed",
  "distance_to_river_m": 450,
  "distance_to_road_m": 1200,
  "distance_to_smelter_km": 28.5,
  "area_ha": 25.0
}
```

### Example Response:
```json
{
  "grid_id": "GRID-SUL-042",
  "prospectivity_score": 8.75,
  "viability_score": 0.85,
  "priority_rank": "HIGH",
  "masked": false,
  "ml_top_features": [
    "lithology: peridotite_simulated (+3.20)",
    "distance_to_smelter_km: 28.50 (+2.10)",
    "slope_deg: 14.50 (+1.45)"
  ],
  "legal_analysis": {
    "is_kill_zone": false,
    "status": "APPROVED",
    "recommendation": "Ready for priority core drilling."
  }
}
```

---

## 🛸 Hardware Payload Integration

The **IGL2 Magnetometer Payload** consists of an ESP32 microcontroller paired with high-sensitivity geomagnetic sensors attached to an exploration drone.

### Key Capabilities:
- 📡 **Real-time Wireless Telemetry:** Transmits Total Magnetic Intensity (TMI) via serial / radio link.
- 📉 **Anomaly Detection:** Identifies magnetic low/high dipoles corresponding to deep fault lines and nickel saprolite/bedrock interfaces.
- 🖥️ **Desktop Monitoring App:** Built with Python Tkinter for live waveform display and data logging.

---

## 📚 Documentation & Quick Links

- 📖 **[PROJECT_STORYLINE.md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/PROJECT_STORYLINE.md)** — Must Read! Full background story, simple analogies, & team breakdown.
- 🧠 **[BACKEND_SYSTEM_FAQ.md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/BACKEND_SYSTEM_FAQ.md)** — Comprehensive technical architecture guide and Q&A defense matrix.
- 🏆 **[FINALIST_ACTION_PLAN.md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/FINALIST_ACTION_PLAN.md)** — Master blueprint for the Finalist stage, 15-slide pitch deck structure, and 2-minute video script.
- 📄 **[Final Proposal Document](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/Final%20Proposal/Proposal%20Penambang%20Handal%20%285%29.md)** — Official ANTAM Hackathon 2026 Submission Proposal.
- 📚 **[finalsource.txt](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/finalsource.txt)** — Academic & geological references (APA 7th edition).

---

## 👥 Tim Penambang Handal (ITB)

| Member | Major | Primary Focus |
| :--- | :--- | :--- |
| **Lian Ridzuan** | Teknik Pertambangan | Domain Expert Geologi, KCMI Code, Mining Economics & Pitching |
| **Rafa Satria Pratama** | Teknik Elektro | Embedded Hardware (ESP32 Drone Payload) & Backend ML |
| **Kevin Yuhan Wahyu Pratama** | Teknik Geofisika | Geophysics (Magnetometer TMI), Remote Sensing & WebGIS |

---

<p align="center">
  <b>NiTERRA v2.0 — Target Fast, Drill Smart, Zero Waste.</b><br>
  <i>ANTAM Hackathon 2026 — Young Mining Innovators</i>
</p>
