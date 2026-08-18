import os, json, csv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_DIR = os.path.join(BASE_DIR, "testing-files")

TEST_CONFIGS = [
    {
        "folder_num": "test1",
        "folder_name": "test1-sorowako-sulsel",
        "site_id": "sorowako",
        "prefix": "SOR",
        "label": "Sorowako Greenfield Interior Ridge (Sulawesi Selatan)"
    },
    {
        "folder_num": "test2",
        "folder_name": "test2-morowali-sulteng",
        "site_id": "morowali",
        "prefix": "MOR",
        "label": "Morowali Deep Greenfield Mountains (Sulawesi Tengah)"
    },
    {
        "folder_num": "test3",
        "folder_name": "test3-wedabay-halmahera",
        "site_id": "weda_bay",
        "prefix": "WED",
        "label": "Weda Bay Central Greenfield Ridge (Maluku Utara)"
    },
    {
        "folder_num": "test4",
        "folder_name": "test4-konawe-sultra",
        "site_id": "konawe",
        "prefix": "KON",
        "label": "Konawe Deep Inland Ridge (Sulawesi Tenggara)"
    },
    {
        "folder_num": "test5",
        "folder_name": "test5-pomalaa-sultra",
        "site_id": "pomalaa",
        "prefix": "POM",
        "label": "Pomalaa Greenfield Interior Range (Sulawesi Tenggara)"
    }
]

def load_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, mode="r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def save_csv(path, fieldnames, rows):
    with open(path, mode="w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

def build_test_packages():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    geo_all = load_csv(os.path.join(DATA_DIR, "geochemistry_dummy.csv"))
    mag_all = load_csv(os.path.join(DATA_DIR, "magnetometer_dummy.csv"))

    for cfg in TEST_CONFIGS:
        pfx = cfg["prefix"]
        site_id = cfg["site_id"]
        
        geo_rows = [r for r in geo_all if r["grid_id"].startswith(pfx)]
        mag_rows = [r for r in mag_all if r["grid_id"].startswith(pfx)]

        site_geojson_path = os.path.join(DATA_DIR, site_id, "study_grid.geojson")
        with open(site_geojson_path, mode="r", encoding="utf-8") as f:
            geojson_data = json.load(f)

        target_dirs = [
            os.path.join(OUT_DIR, cfg["folder_name"]),
            os.path.join(OUT_DIR, cfg["folder_num"])
        ]

        for tdir in target_dirs:
            os.makedirs(tdir, exist_ok=True)

            mag_out = os.path.join(tdir, "magnetometer_data.csv")
            geo_out = os.path.join(tdir, "geochemistry_data.csv")
            grid_out = os.path.join(tdir, "study_grid.geojson")

            if mag_rows:
                save_csv(mag_out, list(mag_rows[0].keys()), mag_rows)
            if geo_rows:
                save_csv(geo_out, list(geo_rows[0].keys()), geo_rows)
            with open(grid_out, mode="w", encoding="utf-8") as f:
                json.dump(geojson_data, f, indent=2)

            readme_out = os.path.join(tdir, "README.md")
            with open(readme_out, mode="w", encoding="utf-8") as f:
                f.write(f"""# {cfg['label']} - Demo Testing Dataset

This folder contains 3 exploration input files ready for upload into **NiTERRA WebGIS Platform**:

1. `magnetometer_data.csv`: UAV Magnetometer raw & structural TMI telemetry ({len(mag_rows)} records).
2. `geochemistry_data.csv`: Multi-element drill assay chemistry records ({len(geo_rows)} records).
3. `study_grid.geojson`: GeoJSON Polygon grid boundaries ({len(geojson_data.get('features', []))} cells).

### How to use on Dashboard:
1. Open the **NiTERRA Dashboard** homepage (`index.html`).
2. Click **Upload Magnetometer CSV** and select `magnetometer_data.csv`.
3. Click **Upload Geochemistry CSV** and select `geochemistry_data.csv`.
4. Click **Upload Study Grid GeoJSON** and select `study_grid.geojson`.
5. Click **Run Analysis** to execute real-time spatial weighting & ML scoring.
""")

        print(f"[OK] Created {cfg['folder_name']} & {cfg['folder_num']} ({len(geojson_data.get('features', []))} cells, {len(geo_rows)} geochem, {len(mag_rows)} mag)")

    # Root README in testing-files
    root_readme = os.path.join(OUT_DIR, "README.md")
    with open(root_readme, mode="w", encoding="utf-8") as f:
        f.write("""# NiTERRA Demo Day Testing Datasets

Welcome Demo Testers & Judges! This directory provides pre-packaged real-world Indonesian nickel laterite exploration datasets ready for testing on the **NiTERRA Dashboard**.

## 📁 Available Test Folders

| Folder | Concession Target | Location / Region | Files Included |
| :--- | :--- | :--- | :--- |
| **`test1`** (`test1-sorowako-sulsel`) | Sorowako Greenfield Interior Ridge | Sulawesi Selatan | 3 input files |
| **`test2`** (`test2-morowali-sulteng`) | Morowali Deep Greenfield Mountains | Sulawesi Tengah | 3 input files |
| **`test3`** (`test3-wedabay-halmahera`) | Weda Bay Central Greenfield Ridge | Halmahera, Maluku Utara | 3 input files |
| **`test4`** (`test4-konawe-sultra`) | Konawe Deep Inland Ridge | Sulawesi Tenggara | 3 input files |
| **`test5`** (`test5-pomalaa-sultra`) | Pomalaa Greenfield Interior Range | Sulawesi Tenggara | 3 input files |

---

## 🚀 Quick Start Instructions
1. Choose any test folder above (e.g. `test1` or `test1-sorowako-sulsel`).
2. On the **NiTERRA Dashboard**, select:
   * **Magnetometer CSV**: `magnetometer_data.csv`
   * **Geochemistry CSV**: `geochemistry_data.csv`
   * **Study Grid GeoJSON**: `study_grid.geojson`
3. Click **Run Analysis**.
""")

if __name__ == "__main__":
    build_test_packages()
