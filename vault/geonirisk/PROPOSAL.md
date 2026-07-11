# PROPOSAL: NiTERRA - Platform Eksplorasi Cerdas Bebasis AI (ANTAM Hackathon 2026)

## 1. Problem Statement
Eksplorasi nikel konvensional seringkali memakan waktu berbulan-bulan dengan biaya capex yang sangat tinggi karena kurangnya optimalisasi penentuan titik bor. Selain itu, aspek tumpang tindih lahan (hutan lindung) dan risiko teknis/K3 di lapangan sulit diidentifikasi di awal.

## 1b. Key Features

| Feature | Description |
|---------|-------------|
| **Pre-Survey ML Prospectivity** | XGBoost scoring (0–10) per grid cell sebelum survei drone — hanya pakai litologi, status hukum, kemiringan, akses jalan, jarak smelter. Backend + client-side fallback. |
| **Interactive Exploration Map** | Leaflet.js dengan overlay sabuk nikel (HIGH/MEDIUM/LOW), batas kawasan hutan (no-go/conditional/allowed), marker tambang. Draw-to-select area eksplorasi. |
| **Multi-Tab Assessment Panel** | Bottom sheet dengan 4 tab: Assessment (GO/CONDITIONAL/NO-GO + skor Safety, Probabilitas Geologi, Ekonomi), 3D Terrain (Plotly.js + elevasi SRTM real), ML Prediction (faktor pendorong, breakdown litologi, sel terbaik/terburuk), Drone Export (top 20 CSV). |
| **Auto-ESG & Permit Draft** | Generative AI (backend + client fallback) yang menghasilkan draf AMDAL/UKL-UPL/PPKH per grid secara spesifik berdasarkan data spasial. Output PDF via html2pdf. |
| **Multi-Layer Map Views** | Toggle antar layer: Prioritas, Magnetometer (nT), Geokimia (sampel), Peta Risiko — dengan legend dan popup detail. |
| **CAPEX Optimization & ROI** | Adaptive drill spacing (50m/100m) berdasarkan confidence ML. Menghitung penghematan biaya pengeboran langsung di dashboard (dalam Rp miliar). |
| **Retrain Pipeline** | Upload data bor baru → retrain model XGBoost via backend → auto-load ke memory tanpa restart. |
| **Ranking Table + Detail Panel** | 30 grid diurutkan dengan bar score, badge prioritas (P1–P4), badge ML. Klik baris → detail panel menampilkan 30+ parameter termasuk ML confidence, QA/QC, compliance, safety, processing route. |
| **3D Block Model** | Scatter3D Plotly interaktif (rotatable, zoomable) — sumbu X/Y = koordinat, Z = skor prioritas, warna = kadar Ni rata-rata. |
| **Feature Importance Visualization** | Bar chart bobot parameter (default: geology-driven heuristic) yang bisa diganti dengan feature importance dari Random Forest/XGBoost real. |

## 2. Data & Method
NiTERRA menggunakan pendekatan integrasi spasial (GIS) dan machine learning (XGBoost).
- **Data Input:** Data magnetometer (nT), geokimia sampel (Ni, Fe, Co, MgO, SiO2), dan batas area eksplorasi (GeoJSON).
- **Integrasi Spasial:** Menggunakan kueri spasial otomatis (PostGIS) untuk menghitung jarak ke jalan, sungai, fasilitas umum, dan memotong data dengan poligon Hutan Lindung KLHK (Kawasan Bebas Tambang).
- **Machine Learning Pipeline:** Stochastic forward model XGBoost memprediksi prospektivitas dengan `ml_cv_score` untuk estimasi konfidensi target, secara independen dilatih pada data historis terverifikasi (Weda Bay district).

## 3. Architecture & Prototype
NiTERRA adalah ekosistem hibrida yang memadukan *software* dan *hardware*:

**Fase 1: Upstream Target Generation (Web Platform)**
- **Peta Potensi & Remote Sensing:** Pemetaan makro target laterit nikel di seluruh Indonesia menggunakan overlay geologi dan proksi vegetasi (Leaflet).
- **Predictive 3D Terrain Analysis:** Pemodelan permukaan 3D (Plotly.js) yang secara matematis menghitung slope untuk memprediksi zona formasi laterit ideal (5°-15°) sebelum tim terjun ke lapangan.
- **Site Assessment Dashboard:** Kalkulator radial yang mensintesis K3 (Keselamatan), Probabilitas Geologi, dan Keekonomian untuk memberikan rekomendasi GO/NO-GO.

**Fase 2: Downstream Field Acquisition & ML (Hardware & Backend)**
- **Drone Geophysics Payload:** Prototipe UAV membawa sensor fluxgate magnetometer untuk menangkap Total Magnetic Intensity (TMI) di area target.
- **Dynamic ML Block Model:** Data magnetometer lapangan diintegrasikan dengan XGBoost Stochastic Forward Model untuk memprediksi kadar nikel 3D.
- **Auto-ESG Drafter:** Generative AI yang otomatis mendraf mitigasi AMDAL/UKL-UPL dan izin kehutanan (PPKH) secara spesifik berdasarkan koordinat spasial PostGIS.

## 4. Feasibility & Business Impact (ROI)
**Efisiensi Capex Pengeboran (ROI):**
Dengan tingkat konfidensi ML yang teruji (CV R² > 0.8), jarak spasi pengeboran awal dapat dilebarkan secara aman dari metode tradisional rapat (50m) menjadi 100m pada zona *high-confidence*.
- **Baseline Cost:** Pengeboran tradisional merata spasi 50m.
- **AI-Optimized Cost:** Spasi adaptif (100m) pada zona prioritas tinggi.
- **Impact:** Menghemat biaya pemboran eksplorasi tahap awal (Rp Miliar) per area target, sekaligus mengurangi *footprint* deforestasi (Land Clearing) guna mendukung tujuan ESG perusahaan. Sistem secara otomatis menghitung *Cost Savings* ini di layar dashboard.

## 5. Kesimpulan
NiTERRA bukan sekadar aplikasi peta; ini adalah instrumen pengambil keputusan end-to-end yang menjembatani keilmuan geosains, machine learning, regulasi legal (ESG), dan keekonomian tambang. Solusi ini siap disandingkan untuk mengoptimalkan pipeline eksplorasi ANTAM secara terukur, lebih murah, dan lebih aman.
