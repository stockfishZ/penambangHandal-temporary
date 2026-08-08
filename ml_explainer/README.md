# 🧠 NiTERRA Machine Learning Explainer & Visualizer

Folder ini berisi visualisasi interaktif dan panduan lengkap tentang bagaimana sistem Machine Learning **NiTERRA (XGBoost Regressor)** bekerja dari hulu ke hilir.

---

## 📁 Isi Folder

1. **`ml_visualizer.html`** — Web App Visualizer Interaktif:
   * **Playground Parameters Sliders:** Geser slider litologi, lereng, indeks satelit (Fe-Oxide B4/B2, Clay B11/B12), anomali magnetik TMI, dan jarak ke sungai untuk melihat perubahan prediksi secara *real-time*.
   * **SHAP Waterfall Contribution Chart:** Penjelasan transparan kenapa AI menaikkan/menurunkan skor prospektivitas.
   * **Decision Tree Traversal Simulator:** Visualisasi bagaimana data berjalan menembus simpul-simpul *decision tree*.
   * **Spatial Block Hold-Out Diagram:** Penjelasan mengapa validasi spasial (Spatial CV) mencegah AI "mencontek" data tetangga.
   * **Penjelasan Geeky/Nerdy:** Penjelasan matematis dengan perumpamaan sederhana.

2. **`explain_ml.py`** — Script Python Inspeksi & Launcher:
   * Membaca metrik performa model nyata dari `backend/ml/model_metadata.json` ($R^2=0.990$, Spearman $\rho=0.989$, RMSE=2.03).
   * Otomatis membuka aplikasi visualizer di browser default.

---

## 🚀 Cara Menjalankan

### Cara 1: Menggunakan Python Script (Disarankan)
```bash
python ml_explainer/explain_ml.py
```
Script akan mencetak laporan metrik di terminal dan langsung membuka tampilan visualizer interaktif di browser.

### Cara 2: Membuka Langsung File HTML
Buka file [ml_explainer/ml_visualizer.html](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/ml_explainer/ml_visualizer.html) langsung di browser favorit Anda (Chrome, Edge, Firefox).

---

*NiTERRA ML Explainer — Transparent, Explainable & Geologically Bulletproof AI.*
