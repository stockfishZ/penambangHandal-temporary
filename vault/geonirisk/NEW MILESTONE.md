# HACKATHON MILESTONE: The End-to-End NiTERRA Autonomous Exploration Pipeline

**Status:** IMPLEMENTED (Upstream Pipeline)
**Theme:** Eksplorasi (Exploration)

This document outlines the architecture for the **NiTERRA Autonomous Exploration Pipeline**, which seamlessly connects macro-level satellite remote sensing to micro-level drone geophysical acquisition.

---

## The Master Workflow

The project is split into two distinct phases: **Upstream (Target Generation)** and **Downstream (Field Acquisition & ML Scoring)**.

```mermaid
graph TD
    %% Upstream Phase
    subgraph Upstream [Phase 1: Target Generation (Web Platform)]
        A[1. Peta Potensi] -->|Regional Targeting| B[2. Analisis Terrain]
        B -->|3D Slope Predictive Model| C[3. Penilaian Lapangan]
    end

    %% Downstream Phase
    subgraph Downstream [Phase 2: Field Acquisition (Hardware & ML)]
        C -->|Handoff: GO Decision| D[4. Drone Deployment]
        D -->|Magnetometer Payload| E[5. Geophysics Processing]
        E -->|Magnetic Anomalies| F[6. ML Block Model]
    end

    classDef upstream fill:#1e293b,stroke:#9FD8BD,stroke-width:2px;
    classDef downstream fill:#1e293b,stroke:#E2A356,stroke-width:2px;
    
    class Upstream,A,B,C upstream;
    class Downstream,D,E,F downstream;
```

---

## Phase 1: Upstream Target Generation (COMPLETED)

We have successfully built a 3-page zero-latency web application using our custom "Nexus" dark-glassmorphism design system. 

### 1. Peta Potensi (`remote-sensing.html`)
**Goal:** Identify WHERE in Indonesia nickel deposits are likely to be found using regional mapping.
- **Implementation:** An interactive Leaflet map featuring hardcoded, heavily researched GeoJSON data of 8 major Indonesian nickel districts (Sorowako, Morowali, Weda Bay, etc.).
- **Ambition for Future:** Integrate live satellite feeds via Google Earth Engine API to automatically scan for vegetation stress anomalies (NDVI) matching laterite profiles across the entire Indonesian archipelago.

### 2. Analisis Terrain (`terrain-analysis.html`)
**Goal:** DetermineWHAT the ground looks like using high-resolution DEMs, and explicitly predict laterite formation zones before boots hit the ground.
- **Implementation:** 
  - **Procedural Remote Sensing Overlays:** Dynamic 2D map layers showing geological boundaries (Ultramafic Formations) and Remote Sensing Anomalies (Iron Oxides/Vegetation).
  - **Predictive 3D Modeling:** The 3D Plotly surface model doesn't just show elevation—it computes the **mathematical derivative (slope)** of the terrain in real-time. It maps a prospectivity colorscale directly onto the mesh:
    - **RED (Optimal):** 5° - 15° slopes where laterites form perfectly.
    - **BLUE (Poor):** Flat swamps (<5°) where smectite clays ruin grades, or steep cliffs (>20°) where erosion strips the ore.
- **Ambition for Future:** Connect directly to real-time 1m LiDAR data feeds and utilize deep learning to identify existing logging roads and canopy density for drone launch pad planning.

### 3. Penilaian Lapangan (`site-assessment.html`)
**Goal:** Answer the multi-million dollar question: SHOULD WE GO?
- **Implementation:** A 3-axis radial scoring dashboard evaluating **Safety**, **Geological Probability**, and **Economic Viability**. It automatically synthesizes terrain roughness, proximity to smelters, and geological context into a decisive **GO / NO-GO** banner.
- **Ambition for Future:** Wire this directly into the ANTAM ERP system to calculate real-time logistics Capex (helicopter rentals, permit delays) against the LME nickel spot price.

---

## Phase 2: Downstream Field Acquisition (TEAMMATES)

Once the Upstream platform generates a **GO** decision, the baton is passed to the engineering and geophysics team in the field.

### 4. Drone Deployment
- **Goal:** The engineering team travels to the safe, highly-probable coordinate identified in Phase 1. They launch a custom-built UAV carrying a miniaturized fluxgate magnetometer (or equivalent sensor).
- **Tooling:** Hardware prototypes built by the engineering team.

### 5. Geophysics Processing (`droneGeophysics.py` & `Codingan IGL2`)
- **Goal:** The drone gathers raw total magnetic intensity (TMI) data. The `droneGeophysics.py` software processes the live telemetry stream.
- **Geophysicist Role:** The `Advanced_Geomagnetic_GUI_Magnetometer.py` (IGL2) tool is used by the geophysicist to perform diurnal corrections, upward continuation, and filtering (RTP - Reduce to Pole) to isolate the shallow ultramafic bedrock anomalies from regional magnetic noise.

### 6. ML Block Model (`index.html` / `app.js`)
- **Goal:** The interpreted geophysical anomalies (magnetic highs corresponding to unweathered peridotite/serpentinite bedrock) are fed back into the NiTERRA ML scoring platform.
- **Integration:** The XGBoost model fuses this high-resolution magnetic data with the slope data from Phase 1 to generate a 3D block model of expected Nickel grades, ready for drilling.

---

## Summary of Impact

By implementing this architecture, we have transformed the hackathon project from a simple map into a **comprehensive, autonomous mining lifecycle manager**. We have proven that software can radically de-risk physical exploration by applying strict geological rules (like slope physics and ultramafic boundaries) *before* a single dollar is spent on flights.