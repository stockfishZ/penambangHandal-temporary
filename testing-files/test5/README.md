# Pomalaa Greenfield Interior Range (Sulawesi Tenggara) - Compact Demo Testing Dataset

This folder contains a compact 16-grid exploration test block ready for rapid testing on the **NiTERRA WebGIS Platform**:

1. `magnetometer_data.csv`: UAV Magnetometer raw & structural TMI telemetry (48 records).
2. `geochemistry_data.csv`: Multi-element drill assay chemistry records (16 records).
3. `study_grid.geojson`: GeoJSON Polygon grid boundaries (16 grid cells).

### How to use on Dashboard:
1. Open the **NiTERRA Dashboard** homepage (`index.html`).
2. Click **Upload Magnetometer CSV** and select `magnetometer_data.csv`.
3. Click **Upload Geochemistry CSV** and select `geochemistry_data.csv`.
4. Click **Upload Study Grid GeoJSON** and select `study_grid.geojson`.
5. Click **Run Analysis** to execute real-time spatial weighting & ML scoring.
