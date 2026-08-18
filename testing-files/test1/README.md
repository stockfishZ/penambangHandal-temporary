# Sorowako Nuha North Inland Mountain Ridge (Sulawesi Selatan) - Compact 4x4 Demo Block

This folder contains a compact 4x4 rectangular exploration test block (16 grid cells) ready for rapid testing on the **NiTERRA WebGIS Platform**:

1. `magnetometer_data.csv`: UAV Magnetometer raw & structural TMI telemetry (48 records).
2. `geochemistry_data.csv`: Multi-element drill assay chemistry records (16 records).
3. `study_grid.geojson`: GeoJSON Polygon 4x4 rectangular grid block (16 grid cells).

### How to use on Dashboard:
1. Open the **NiTERRA Dashboard** homepage (`index.html`).
2. Click **Upload Magnetometer CSV** and select `magnetometer_data.csv`.
3. Click **Upload Geochemistry CSV** and select `geochemistry_data.csv`.
4. Click **Upload Study Grid GeoJSON** and select `study_grid.geojson`.
5. Click **Run Analysis** to execute real-time spatial weighting & ML scoring.
