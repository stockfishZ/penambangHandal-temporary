### THE TRUTH ABOUT THIS PROJECT

The current frontend (vanilla JS + Leaflet) is faking the AI logic using a hardcoded, open-loop weighted heuristic formula in `app.js`. This will not survive technical judging. We are replacing this setup with a robust, industry-standard stack:

- Database: PostgreSQL + PostGIS (for real spatial querying).

- Backend: Python + FastAPI (the analytical bridge and ML inference engine).

- ML Layer: Scikit-Learn / XGBoost (predicting actual mining prospectivity).

- Frontend: Leaflet.js (strictly UI/rendering data from the backend).



### YOUR OPERATIONAL RULES

1. Minimal Talk, Maximum Code: Do not write conversational filler, long introductions, or summaries. Treat me as your project manager. Give me straight-to-the-point suggestions and pure, optimized code blocks.

2. Absolute File Location Clarity: For EVERY single piece of code you provide, you MUST explicitly state the exact directory path, file name, and where within the existing structure it must be injected or replaced (e.g., "In `backend/main.py`, replace lines 15-30 with:").

3. Slice-by-Slice Execution: We will build this system incrementally. Do not dump the entire project at once. Focus ONLY on the active phase, deliver the clean implementation, and wait for my explicit confirmation before moving to the next step.



### THE SPECIFIC SYSTEM REQUIREMENTS

- Spatial Data Inputs (PostGIS): The system must calculate distances from grid coordinates to the nearest road (and classify road type), nearest water point, nearest settlement (pemukiman), and nearest nickel smelter (for distribution/logistics mapping).

- Land Legality Classification: The system must intersect coordinates with Indonesian land boundaries to determine if a grid falls within "Hutan Lindung", "Hutan Produksi", or other categories, and output the specific laws (UUD/Izin) governing that piece of land.

- Machine Learning Pipeline: The spatial features fetched from PostGIS must be combined with physical magnetometer and geochemistry data streams to feed into an ML classification/regression model to calculate the definitive priority rank.



---



### OUR DEVELOPMENT ROADMAP

You will guide me through these phases one slice at a time.



#### PHASE 1: PostGIS Database Architecture & Spatial Queries

- Provide the database schema and SQL scripts to set up the spatial tables (roads, water, settlements, smelters, and forestry boundaries).

- Provide the exact PostGIS SQL queries using ST_Distance and ST_Intersects to pull all necessary spatial features for a given coordinate.



#### PHASE 2: FastAPI Backend & Pipeline Setup

- Build the directory structure for a Python FastAPI server.

- Write the database connection pooling and code endpoints (e.g., `POST /api/analyze-grid`) to receive client data, trigger the PostGIS spatial queries, and prepare the feature arrays.



#### PHASE 3: ML Model Integration Blueprint

- Implement the model loading pipeline (`joblib` or `onnx`) within FastAPI.

- Create an intelligent fallback/mock ML inference logic that outputs realistic model probabilities based on the incoming features until the real model is fully trained.



#### PHASE 4: Frontend Refactoring

- Rewrite `app.js` to strip out all math, hardcoded weights, and local processing logic.

- Implement the clean `fetch()` API calls to send upload payloads directly to our FastAPI endpoints and dynamically render the returned JSON priority maps and legal data onto the Leaflet map.



#### PHASE 5: Quality Check & End-to-End Optimization

- Audit the entire data flow for edge-case failures, unhandled spatial nulls, and lag.



---



### COMPLETED PHASES
- PHASE 1: PostGIS Database Architecture & Spatial Queries (Schema design and setup).
- PHASE 2: FastAPI Backend & Pipeline Setup (Database connectivity, main application structure, and `/api/analyze-grid` endpoint stub).

### CURRENT TASK: PHASE 3, STEP 1
- ML Model Integration Blueprint: Implement model loading and inference logic.