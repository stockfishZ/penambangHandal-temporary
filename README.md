# 🚀 NiTERRA v2.0 — Next-Gen Nickel Exploration Target & Risk Analytics
> **ANTAM Hackathon 2026 — Young Mining Innovators (Top 10 Finalist)**  
> Developed by **Tim Penambang Handal (ITB)**: Lian Ridzuan, Rafa Satria Pratama, Kevin Yuhan Wahyu Pratama.

---

## 📌 Quick Links & Navigation

* 📖 **[PROJECT_STORYLINE.md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/PROJECT_STORYLINE.md)** — *Must Read!* Cerita lengkap proyek, cara kerja, & perumpamaan sederhana untuk pemahaman cepat tim.
* 🏆 **[FINALIST_ACTION_PLAN.md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/FINALIST_ACTION_PLAN.md)** — Master blueprint teknis babak final, 15-slide pitch deck, Q&A defense matrix, & 2-min video script.
* 📄 **[Final Proposal/Proposal Penambang Handal (5).md](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/Final%20Proposal/Proposal%20Penambang%20Handal%20%285%29.md)** — Dokumen Proposal Resmi ANTAM Hackathon 2026.
* 📚 **[finalsource.txt](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/finalsource.txt)** — Daftar Pustaka Lengkap (APA 7th edition).

---

## 🛠️ Architecture Overview

```
[ Sentinel-2 Satellite ] + [ Drone Magnetometer ] ➡️ [ XGBoost AI Engine ] ➡️ [ Leaflet 2D / WebGL 3D WebGIS ]
```

1. **Frontend WebGIS:** [index.html](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/index.html) (2D Interactive Leaflet Viewer) & [terrain-analysis.html](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/terrain-analysis.html) (3D WebGL DEM Mesh).
2. **Backend API & ML:** `backend/` (FastAPI + XGBoost Regressor for Prospectivity & Risk Scoring).
3. **Hardware Payload:** `Codingan IGL2 Magnetometer/` (ESP32 Firmware + Real-time Tkinter GUI Monitoring App).

---

## 🚀 Getting Started

### 1. WebGIS Local Server
Open [index.html](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/index.html) directly in any modern browser, or serve via local dev server.

### 2. Backend FastAPI Server
```bash
cd backend
pip install -r requirements.txt
python run.py
```

### 3. Real-Time Hardware GUI Monitor
```bash
python "Codingan IGL2 Magnetometer/Advanced_Geomagnetic_GUI_Magnetometer.py"
```

---

*NiTERRA v2.0 — Target Fast, Drill Smart, Zero Waste.*
