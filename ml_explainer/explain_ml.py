"""
NiTERRA Machine Learning Engine Visualizer & Inspector Script
Run this script to inspect model performance metrics, feature importances, and launch the interactive visualizer in your web browser.
"""

import os
import sys
import json
import webbrowser
import http.server
import socketserver
import threading
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_META_PATH = os.path.join(BASE_DIR, "backend", "ml", "model_metadata.json")
EXPLAINER_HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")

def print_banner():
    print("=" * 65)
    print("   🧠 NiTERRA v2.0 — MACHINE LEARNING ENGINE INSPECTOR & EXPLAINER")
    print("=" * 65)

def inspect_metadata():
    if not os.path.exists(MODEL_META_PATH):
        print("⚠️ Model metadata file not found at:", MODEL_META_PATH)
        print("   Using default demonstration metrics.")
        return

    with open(MODEL_META_PATH, encoding="utf-8") as f:
        meta = json.load(f)

    print("\n📊 MODEL METRICS & SPATIAL VALIDATION REPORT")
    print("-" * 50)
    print(f"  • Total Features      : {meta.get('n_features', 17)}")
    print(f"  • Training Samples   : {meta.get('train_samples', 0):,} grid cells ({', '.join(meta.get('train_regions', []))})")
    print(f"  • Test Samples (SE)  : {meta.get('test_samples', 0):,} grid cells (Spatial Hold-Out)")
    
    train_m = meta.get("train_metrics", {})
    test_m = meta.get("test_metrics", {})
    
    print("\n📈 PERFORMANCE SCORES:")
    print(f"  • Train R² Score      : {train_m.get('r2', 0):.4f}")
    print(f"  • Test R² Score       : {test_m.get('r2', 0):.4f} (Spatial Holdout Validation)")
    print(f"  • Spearman Correlation: {test_m.get('spearman', 0):.4f}")
    print(f"  • Test RMSE           : {test_m.get('rmse', 0):.4f}")
    print(f"  • Test MAE            : {test_m.get('mae', 0):.4f}")
    print("-" * 50)

def launch_visualizer():
    if not os.path.exists(EXPLAINER_HTML_PATH):
        print("❌ Visualizer HTML file missing at:", EXPLAINER_HTML_PATH)
        return

    print("\n🌐 Launching Interactive ML Visualizer Web App...")
    
    # Try opening file directly or serve via local HTTP server
    port = 8085
    handler = http.server.SimpleHTTPRequestHandler
    
    def start_server():
        os.chdir(os.path.dirname(EXPLAINER_HTML_PATH))
        with socketserver.TCPServer(("", port), handler) as httpd:
            httpd.serve_forever()

    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    time.sleep(0.5)
    url = f"http://localhost:{port}/index.html"
    print(f"✨ Visualizer running at: {url}")
    webbrowser.open(url)
    print("\nPress Ctrl+C in terminal to stop server.\n")

if __name__ == "__main__":
    print_banner()
    inspect_metadata()
    launch_visualizer()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 ML Inspector server stopped.")
