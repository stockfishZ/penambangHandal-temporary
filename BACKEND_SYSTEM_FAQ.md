# 🧠 NiTERRA v2.0 — Backend System FAQ & Q&A Defense Guide
> **ANTAM Hackathon 2026 — Young Mining Innovators (Finalist Stage)**  
> **Target Audience:** Tim Penambang Handal (Lian, Rafa, Kevin)  
> **Purpose:** Panduan praktis & teknis untuk memahami alur data backend (Membaca ➡️ Memproses ➡️ Mengeluarkan Data) dan siap menjawab pertanyaan sulit Mentor/Juri di Babak Final.

---

## 📌 Executive Summary: Alur Backend 30-Detik (Untuk Pitch)

Jika Mentor/Juri bertanya: *"Bagaimana sistem backend NiTERRA mengolah data dari input sampai output?"*, jawab dengan 3 langkah sederhana ini:

```
┌─────────────────────────┐     ┌──────────────────────────────────────────────┐     ┌─────────────────────────┐
│ 1. DATA INGESTION       │ ──> │ 2. DUAL-ENGINE PROCESSING                    │ ──> │ 3. OUTPUT SYSTEM        │
│ • Frontend (Lat/Lon/Grid)│     │ • Spatial & Legal Engine (PostGIS + BIG API) │     │ • Prospectivity & Risk  │
│ • PostGIS Spatial Database│    │ • AI Prospectivity Engine (XGBoost ML)       │     │ • 2D/3D WebGIS Overlay  │
│ • BIG One Map Server    │     │ • ESG Automated Compliance Generator         │     │ • ESG Draft Document    │
└─────────────────────────┘     └──────────────────────────────────────────────┘     └─────────────────────────┘
```

---

## 🗂️ BAB 1: DATA INGESTION — Bagaimana Backend Membaca Data?

### Q1.1: Dari mana saja data masuk ke backend NiTERRA?
Backend (`backend/app/main.py`) menerima data dari 4 sumber utama:
1. **HTTP Request Payload (Dari Frontend WebGIS):**  
   Frontend mengirimkan koordinat target (`latitude`, `longitude`), ID grid (`grid_id`), kemiringan lereng (`slope_deg`), litologi batuan (`lithology`), dan status hukum awal via JSON REST API (`/api/analyze-grid` atau `/api/analyze-batch`).
2. **Database Spasial Lokal (PostGIS / PostgreSQL):**  
   File [`database.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/database.py) mengelola koneksi PostGIS. Database ini menyimpan layer vektor geospasial resmi: `osm_roads` (jalan), `osm_waterways` (sungai/perairan), `klhk_forestry_boundaries` (kawasan hutan KLHK).
3. **API Pemerintah Eksternal (BIG One Map Server):**  
   File [`big_api.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/big_api.py) melakukan fallback *real-time spatial query* ke server Badan Informasi Geospasial (BIG) `kspservices.big.go.id` via ArcGIS REST Service untuk memverifikasi batas hutan terbaru.
4. **Model & Metadata ML Terlatih:**  
   File [`inference.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py) membaca file model terkompresi [`model.pkl`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/model.pkl) dan [`model_metadata.json`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/model_metadata.json).

---

### Q1.2: Apa yang terjadi jika database lokal PostGIS atau API BIG mati/lambat?
Sistem NiTERRA dirancang dengan **Graceful Fallback Mechanism (Multi-Tier Resiliency)**:
* **Tier 1 (Utama):** Memakai PostGIS SQL spatial query (`ST_Distance`, `ST_Intersects`). Fast & accurate.
* **Tier 2 (Fallback Spasial):** Jika PostGIS tidak mendeteksi status hutan, backend memanggil `big_query_point(lat, lon)` ke API BIG Satu Peta.
* **Tier 3 (Offline Safe):** Jika kedua database geospasial offline, sistem tidak akan *crash/500 Error*. Backend menggunakan fitur estimasi spasial dari parameter input frontend (`request.distance_to_road_m`, `request.distance_to_river_m`) dan melanjutkan kalkulasi.

---

### Q1.3: Mengapa data hasil survey magnetometer & geokimia tidak dimasukkan ke dalam fitur training AI awal?
* **Jawaban Geologis & Data Integrity:**  
  Dalam eksplorasi nikel tahap awal (*greenfield*), data geokimia bor dan survey drone magnetik **belum ada** (*pre-survey*). Jika AI dilatih menggunakan data hasil bor, akan terjadi **Data Leakage (Kebocoran Data)**. 
* Oleh karena itu, XGBoost NiTERRA dilatih murni dari **fitur pre-survey** (lereng DEM, litologi ultramafik, jarak ke sungai, jarak ke jalan, jarak ke smelter, status hukum). Data magnetik drone dan geokimia diperlakukan sebagai layer konfirmasi sekunder di WebGIS.

---

## ⚙️ BAB 2: DATA PROCESSING — Bagaimana Backend Memproses Data?

Data diproses melalui **Dua Mesin Utama (Dual-Engine Architecture)** yang berjalan secara paralel di backend:

```
                                  ┌─── Engine 1: Legal & ESG Rules (PostGIS / BIG API) ──> Viability Score (0.0 - 1.0)
Request (Lat, Lon, Terrain) ──────┤
                                  └─── Engine 2: Machine Learning (XGBoost Regressor)  ──> Prospectivity Score (0.0 - 10.0)
```

### Q2.1: Bagaimana "Engine 1 — Spasial, Legal & ESG Rules" Bekerja?
Fungsi `_compute_analysis()` di [`main.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/main.py#L78-L161) mengevaluasi kelayakan hukum dan lingkungan (*Viability Score* dari `0.0` sampai `1.0`):

1. **Aturan "Kill-Zone" Hard Exclusion:**  
   Jika koordinat berada di **Hutan Lindung** (`is_kill_zone = True`), maka `viability_score = 0.0`. Area langsung diblokir total untuk pemboran.
2. **Buffer Zona Penyangga (Permen LHK 4/2021 & Kepmen ESDM 1827 K/30/MEM/2018):**
   * **Buffer Jalan / Fasilitas Publik < 500m:** `viability_score = 0.0` (mencegah kerusakan infrastruktur umum).
   * **Buffer Pemukiman < 500m:** `viability_score = 0.0` *kecuali* ada kajian teknis kestabilan lereng (`kajian_teknis_kestabilan = True`), di mana skor dikurangi menjadi `0.5`.
   * **Buffer Pemukiman 500m - 2000m:** Penalti bertahap (`0.7` hingga `0.85`).
   * **Aksesibilitas Logistik:** Jarak ke jalan > 5 km mengurangi skor ke `0.7`; > 10 km mengurangi ke `0.5`.
   * **Sempadan Sungai/Perairan:** Jika masuk buffer hidrologi, skor dikurangi ke `0.6` untuk proteksi pencemaran air.

---

### Q2.2: Bagaimana "Engine 2 — Machine Learning XGBoost" Memprediksi Potensi Nikel?
Dilakukan oleh [`ProspectivityModel`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py#L49):

1. **Vektorisasi Fitur (`_to_vector`):**  
   Data mentah diubah menjadi matriks fitur numerik dengan *One-Hot Encoding*:
   * Fitur Kontinu: `slope_deg`, `distance_to_river_m`, `distance_to_road_m`, `distance_to_smelter_km`, `area_ha`.
   * Litologi (One-Hot): `lith_peridotite_simulated`, `lith_serpentinite_simulated`, `lith_ultramafic_simulated`, dll.
   * Status Legal (One-Hot): `legal_allowed`, `legal_conditional`, `legal_no_go`.
2. **Eksekusi Model (`model.predict`):**  
   XGBoost Regressor menghitung estimasi **Target Prospectivity Score** dengan skala `0.0` hingga `10.0`.
3. **Penyaringan Masking (`predict_masked`):**  
   Jika status area adalah `no-go` atau jarak ke jalan < 500m, AI **secara otomatis menimpa skor menjadi `0.0`** dengan flag `masked = True` dan menyebutkan alasan spesifik (`block_reason`).
4. **Resilient Heuristic Fallback:**  
   Jika library XGBoost tidak terinstall/model pkl tidak ditemukan, backend secara otomatis beralih ke *heuristic score algorithm* berbasis bobot geologi agar API tetap merespon 200 OK.

---

### Q2.3: Bagaimana sistem menjelaskan "Mengapa AI memberikan skor sekian?" (Explainable AI / XAI)
Juri/Mentor pasti bertanya: *"Apakah AI ini Black Box?"*  
**Jawab: TIDAK.** NiTERRA menggunakan fitur **Sensitivity & Feature Importance Analysis** di fungsi [`_feature_importance()`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py#L162-L175):
* Backend mengukur seberapa besar perubahan skor jika satu variabel diubah (*vector perturbation*).
* Hasilnya dikembalikan dalam JSON berupa list `ml_top_features` (5 faktor paling berpengaruh), misalnya:
  1. Litologi Peridotit (+3.2 poin)
  2. Jarak ke Smelter < 45km (+2.1 poin)
  3. Kelerengan Optima 8° (+1.4 poin)

---

### Q2.4: Apakah ada "Closed-Loop / Circular Logic" antara data sintetik (`forward_model.py`) dan AI (`inference.py`)?
**Jawaban Tegas: TIDAK ADA.**
* File [`forward_model.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/forward_model.py) menggunakan kurva **Michaelis-Menten** ($V_{max} \cdot \frac{Ni}{Ni + K_m}$) dan interaksi perkalian (*multiplicative*) yang bergantung pada variabel rahasia `true_ni_pct` (yang tidak pernah diberikan ke ML).
* Sebaliknya, [`inference.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py) murni melatih XGBoost pada fitur geospasial *pre-survey* tanpa pernah melihat variabel `true_ni_pct`. Ini membuktikan tidak ada kebocoran data (*zero circular logic*).

---

## 📤 BAB 3: OUTPUT SYSTEM — Bagaimana Backend Mengeluarkan & Menyajikan Data?

### Q3.1: Format data apa yang dihasilkan oleh backend?
Backend menghasilkan response berformat **JSON Standardised REST Payload** yang berisi 7 section utama:

```json
{
  "grid_id": "GRID-SUL-042",
  "coordinate": { "lat": -2.543, "lng": 121.342 },
  "viability_score": 0.85,
  "ml_score": 8.42,
  "ml_masked": false,
  "ml_block_reason": null,
  "ml_top_features": [
    { "feature": "lith_peridotite_simulated", "importance": 0.42, "impact": 3.5 },
    { "feature": "distance_to_smelter_km", "importance": 0.28, "impact": 2.1 }
  ],
  "compliance": {
    "kill_zone": false,
    "buffer_zone": false,
    "permit_status": "PPKH Required"
  },
  "legal_context": {
    "kelas_hutan": "Hutan Produksi Terbatas",
    "legal_reference": "UU 3/2020; PP 96/2021",
    "mitigation_requirements": "Wajib pengajuan PPKH & PNBP DAS 1:1"
  }
}
```

---

### Q3.2: Bagaimana Frontend WebGIS memanfaatkan output dari backend ini?
Output JSON dari backend dikonsumsi oleh dua interface frontend utama:
1. **2D Interactive WebGIS (`index.html`):**  
   * **Leaflet JS Engine** menerima array grid dari API `/api/analyze-batch`.
   * Menggambar poligon grid dengan pewarnaan dinamis (*Color-Coded Heatmap*):
     * 🟢 **Hijau (Skor > 7.0 & Viability 1.0):** Prioritas Bor Utama (*High Prospect, Safe*).
     * 🟡 **Kuning (Skor 4.0 - 7.0 & Viability > 0.5):** Target Sekunder (Perlu Izin Tambahan).
     * 🔴 **Merah / Terkunci (Viability 0.0 / Masked):** *No-Go Zone* (Hutan Lindung / Penalti Buffer).
2. **3D WebGL DEM Elevation Mesh (`terrain-analysis.html`):**  
   * Menggabungkan data elevasi DEM dengan skor kelayakan AI untuk memproyeksikan target bor langsung di atas kontur relief 3D permukaan bumi.

---

### Q3.3: Bagaimana fitur "ESG Draft Generator" (`/api/generate-esg-draft`) bekerja?
Backend tidak hanya memberikan angka skor, tetapi juga merancang **Draft Dokumen Pra-Kajian Lingkungan & K3 Otomatis** sesuai regulasi tambang Indonesia:
* **Penggunaan Kawasan Hutan (Permen LHK 7/2021):** Jika area berada di Hutan Produksi/Terbatas, backend otomatis menerbitkan klausul kewajiban izin **PPKH (Persetujuan Penggunaan Kawasan Hutan)** & bayar PNBP serta rehabilitasi DAS 1:1.
* **Dokumen Lingkungan (Permen LHK 4/2021):** Jika jarak sungai < 500m, sistem mewajibkan dokumen **AMDAL** + *Settling Pond* penangkap TSS. Jika > 500m, cukup dokumen **UKL-UPL**.
* **Keselamatan K3 & Geoteknik (Kepmen ESDM 1827 K/30/MEM/2018):** Jika kemiringan lereng > 25°, backend mewajibkan penggunaan rig bor *man-portable* (Jacro) untuk mencegah longsor & land clearing berlebih.
* **Kalkulasi ROI & Efisiensi Capex:** Menghitung penghematan anggaran pemboran (Rp Miliar) dari optimasi spasi bor AI.

---

## 🛡️ BAB 4: MENTOR & JUDGE KILLER Q&A DEFENSE MATRIX

Gunakan matriks jawaban ini jika Mentor atau Juri melontarkan pertanyaan teknis backend saat Q&A:

| Pertanyaan Mentor / Juri | Siapa yang Menjawab? | Jawaban Ringkas & Tepat Sasaran | Bukti Teknis di Kode Backend |
| :--- | :--- | :--- | :--- |
| *"Bagaimana kalian menjamin AI tidak menyarankan pemboran di Hutan Lindung?"* | **Lian / Rafa** | "Kami menerapkan *Hard Masking Gatekeeper* di backend. Sebelum AI menghitung skor, PostGIS & BIG API memeriksa perpotongan kelerengan dan kawasan hutan. Jika `is_kill_zone` true, skor kelayakan langsung dikunci mati di `0.0` (`ml_masked = true`)." | [`main.py#L125-L126`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/main.py#L125-L126) & [`inference.py#L79-L80`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py#L79-L80) |
| *"Apakah backend kalian bergantung penuh pada koneksi internet server luar?"* | **Rafa / Kevin** | "Tidak. Backend NiTERRA mengutamakan database PostGIS lokal untuk query spasial kilat. API BIG Satu Peta hanya digunakan sebagai Tier-2 fallback jika ada daerah yang belum ter-cover database lokal." | [`main.py#L84-L113`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/main.py#L84-L113) & [`big_api.py`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/big_api.py) |
| *"Bagaimana kalian membuktikan AI XGBoost ini tidak asal menebak (Black Box)?"* | **Rafa** | "Backend kami mengeksekusi *sensitivity perturbation test* pada vektor input setiap kali inference dijalankan. Hasilnya adalah urutan 5 fitur teratas (`ml_top_features`) beserta bobot kontribusinya, sehingga geologis ANTAM tahu persis *kenapa* skor tersebut keluar." | [`inference.py#L162-L175`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py#L162-L175) |
| *"Mengapa kalian menggunakan XGBoost, bukan Deep Learning / CNN?"* | **Rafa / Kevin** | "Untuk data tabular geospasial bernilai spesifik (*structured GIS & terrain features*), algoritma Gradient Boosted Trees seperti XGBoost terbukti secara akademis mengungguli Deep Learning dalam hal akurasi, efisiensi komputasi, dan kemampuan interpretabilitas (XAI)." | [`inference.py#L6-L10`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/ml/inference.py#L6-L10) |
| *"Apakah rekomendasi lingkungan kalian sesuai dengan regulasi resmi Indonesia?"* | **Lian** | "Sangat sesuai. Modul ESG backend kami diprogram mengikuti perundang-undangan resmi: UU No. 3/2020 (Minerba), Permen LHK No. 7/2021 (PPKH), Permen LHK No. 4/2021 (AMDAL/UKL-UPL), dan Kepmen ESDM 1827 K/2018 (Geoteknik & K3 Pertambangan)." | [`main.py#L317-L364`](file:///D:/ProjectPython/Penambang%20Handal/penambangHandal-temporary/backend/app/main.py#L317-L364) |

---

## 🚀 Pembagian Tugas Tim Saat Presentasi & Q&A Final

* ⛏️ **Lian Ridzuan:** Menjelaskan dampak bisnis, kelayakan hukum (PPKH/AMDAL/Kepmen 1827), penghematan capex/ROI, dan rekomendasi titik bor akhir.
* ⚡ **Rafa Satria Pratama:** Menjelaskan arsitektur API FastAPI, logika Machine Learning XGBoost, fungsi masking/kill-zone, dan Explainable AI (XAI).
* 🌌 **Kevin Yuhan Wahyu Pratama:** Menjelaskan pengolahan data geospasial (PostGIS/BIG API), data magnetik drone ESP32, serta visualisasi WebGIS 2D & 3D.

---
*NiTERRA v2.0 — Target Fast, Drill Smart, Zero Waste.*  
*Ready to Win ANTAM Hackathon 2026!* 🏆
