# 🧠 NiTERRA Machine Learning Explainer & Terminology Dictionary

Dokumen ini adalah **panduan ringkas, padat, dan mudah dipahami** mengenai cara kerja Machine Learning (AI) di NiTERRA, lengkap dengan **Kamus Istilah ML (Jargon Buster)** dan **Panduan Menjawab Pertanyaan Juri ANTAM**.

---

## ⚡ 1. The 30-Second Elevator Pitch (Konsep Inti AI NiTERRA)

> *"NiTERRA tidak menggunakan AI sebagai 'black box' yang asal tebak. Kami menggunakan **XGBoost Regressor** yang dilatih untuk mempelajari pola non-linear antara **geologi ultramafik, anomali magnetik drone, geokimia tanah, dan topografi**, lalu menghasilkan **Prospectivity Score (0–10)** untuk setiap grid. Model ini diuji dengan **Spatial Block Hold-Out pada 200.101 grid** untuk memastikan model tetap akurat pada wilayah baru yang belum pernah dibor."*

---

## 🔄 2. Cara Kerja Pipeline ML NiTERRA (Step-by-Step)

```
[ Input Eksplorasi ]
  ├── Drone TMI Magnetometer (nT)
  ├── Geokimia Tanah (Ni, Fe, Co, MgO, SiO2)
  ├── DEM Topografi & Kemiringan Lereng (deg)
  ├── Aksesibilitas (Jarak Jalan, Sungai, Smelter)
  └── Litologi & Status Legalitas Kawasan
         │
         ▼
[ Feature Engineering (17 Fitur) ]
         │
         ▼
[ XGBoost ML Regressor ] ──> Memprediksi ML Prospectivity Score (0–10)
         │
         ▼
[ Rule-Based ESG & Kill-Zone Masking ]
  ├── Jika Lereng > 30° atau Sempadan Sungai < 100m ──> Flag High Risk
  └── Jika Kawasan No-Go / Hutan Lindung ──> ML Score di-MASK (Score = 0)
         │
         ▼
[ Multi-Criteria Decision Making (MCDM) ]
  └── Menggabungkan ML Score + Geokimia + Geofisika + Remote Sensing (0–100)
         │
         ▼
[ Output Keputusan Akhir ]
  ├── Prioritas Target (Priority 1, 2, 3)
  ├── Rekomendasi Spasi Bor (100m vs 50m KCMI 2017)
  └── Estimasi Kebutuhan Titik Bor & CAPEX Jacro Drilling (Rp)
```

---

## 📊 3. 17 Fitur yang Masuk ke Model ML (`features.py`)

Model membaca 17 fitur numerik & kategorikal untuk setiap grid:

| Kategori | Fitur Input | Penjelasan Geologi / Operasional |
| :--- | :--- | :--- |
| **Topografi & Medan** | `slope_deg` | Kemiringan lereng (laterit nikel tebal ideal di lereng landai 5°–15°). |
| **Hidrologi** | `distance_to_river_m` | Jarak ke sungai (mitigasi sedimentasi & batas sempadan air). |
| **Aksesibilitas** | `distance_to_road_m` | Jarak ke jalan logistik (efisiensi mobilisasi alat bor Jacro). |
| **Logistik Hilir** | `distance_to_smelter_km`| Jarak ke smelter HPAL/RKEF terdekat (keekonomian bijih). |
| **Dimensi** | `area_ha` | Luas area target grid cell. |
| **Litologi (One-Hot)** | `lith_peridotite`, `lith_serpentinite`, `lith_ultramafic`, `lith_limestone`, dll. | Jenis batuan dasar (peridotit/serpentinit adalah batuan induk nikel laterit berkadar tinggi). |
| **Status Legal** | `legal_allowed`, `legal_conditional`, `legal_no_go` | Status kawasan izin (IUP operasi vs Hutan Lindung vs Konservasi). |

---

## 📖 4. Kamus Istilah ML (Machine Learning Dictionary for Non-ML)

Gunakan bagian ini jika Anda lupa istilah teknis saat ditanya dewan juri:

### 🔹 1. Overfitting (Terlalu Menghafal)
* **Artinya**: Kondisi di mana model AI **terlalu menghafal data latihan (train data)** sampai ke detail noise-nya, sehingga nilainya 100% sempurna di data latihan, tapi **hancur/ngaco saat diuji pada area baru di lapangan**.
* **Cara NiTERRA Mencegahnya**: 
  - Membatasi kedalaman pohon (`max_depth = 4`).
  - Menggunakan `subsample = 0.8` (hanya 80% data acak per pohon).
  - Validasi dengan **Spatial Hold-Out** (bukan K-Fold biasa).

### 🔹 2. Underfitting (Terlalu Bodoh/Sederhana)
* **Artinya**: Model terlalu sederhana (seperti regresi garis lurus sederhana) sehingga gagal menangkap pola hubungan geologi yang kompleks antara magnetik, kadar nikel, dan pelapukan lereng.

### 🔹 3. K-Fold Cross-Validation
* **Artinya**: Metode menguji AI dengan membagi data menjadi $K$ bagian (misal 5 bagian). 4 bagian untuk melatih, 1 bagian untuk menguji, lalu dirotasi 5 kali.
* **Kelemahan K-Fold Biasa di Data Tambang**: Terjadi **Spatial Data Leakage** (kebocoran data). Jika titik bor A dan titik bor B hanya berjarak 10 meter, AI bisa "menyontek" titik tetangganya meskipun ada di kelompok tes.

### 🔹 4. Spatial Block Hold-Out Validation (Yang Dipakai NiTERRA ⭐)
* **Artinya**: Menguji AI dengan memisahkan **seluruh blok wilayah geografis**.
* **Contoh di NiTERRA**: Data dibagi 5 region geografis (`NW`, `NE`, `C`, `SW`, `SE`). Model dilatih hanya pada 4 region (`C`, `NE`, `NW`, `SW` = 799.899 sampel), lalu diuji secara buta (*blind test*) pada region `SE` (**200.101 sampel**).
* **Kenapa Hebat**: Membuktikan bahwa AI NiTERRA benar-benar bisa memprediksi deposit di wilayah baru (*greenfield exploration*) tanpa pernah melihat wilayah tersebut sebelumnya.

### 🔹 5. $R^2$ (R-Squared / Koefisien Determinasi)
* **Artinya**: Mengukur seberapa banyak variasi data yang berhasil dijelaskan oleh model (skala 0 sampai 1.0, atau 0% sampai 100%).
* **Nilai NiTERRA ($R^2 = 0,842$)**: Model mampu menjelaskan **84,2%** variansi prospektivitas laterit secara akurat.

### 🔹 6. Spearman $\rho$ (Spearman Rank Correlation) ⭐ *Paling Penting untuk Eksplorasi!*
* **Artinya**: Mengukur ketepatan **urutan ranking** prediksi AI vs ranking asli lapangan (skala -1.0 sampai +1.0).
* **Nilai NiTERRA ($\rho = 0,885$)**: Tingkat ketepatan urutan prioritas mencapai **88,5%**. Artinya, target yang dinobatkan sebagai Prioritas 1 oleh AI terbukti secara konsisten adalah target terbaik di lapangan.

### 🔹 7. RMSE & MAE (Root Mean Squared Error & Mean Absolute Error)
* **Artinya**: Rata-rata margin kesalahan (error) angka prediksi AI dibandingkan nilai asli. Semakin kecil angkanya, semakin presisi AI.

### 🔹 8. XGBoost (Extreme Gradient Boosting)
* **Artinya**: Algoritma AI berbasis kumpulan ratusan *Decision Trees* (pohon keputusan) yang belajar secara bertahap dari kesalahan pohon sebelumnya (*boosting*).
* **Kenapa Dipakai**: XGBoost adalah **standar emas industri dunia untuk data tabular/spreadsheet geologi**, jauh lebih stabil, cepat, dan akurat dibanding Deep Learning / Neural Network untuk data eksplorasi.

### 🔹 9. Feature Importance (Tingkat Pengaruh Fitur)
* **Artinya**: Grafik yang menunjukkan variabel mana yang paling mempengaruhi keputusan AI (misal: litologi peridotit dan kemiringan lereng memiliki bobot terbesar dalam menentukan keberadaan nikel tebal).

### 🔹 10. Active Learning & Model Retraining
* **Artinya**: Siklus di mana AI terus belajar dari data baru. Ketika 20 lubang bor baru selesai dibor dan hasil lab assay keluar, geolog mengunggah CSV baru tersebut via tombol **"Upload New Drill Data & Retrain"** $\rightarrow$ AI langsung melatih ulang bobotnya secara otomatis.

---

## 🎯 5. Tanya-Jawab Kritis Dewan Juri (Q&A Defense Guide)

### ❓ Tanya 1: *"Kenapa pakai XGBoost? Kenapa tidak pakai Deep Learning / Neural Network?"*
> **Jawaban Anda**:
> *"Untuk data eksplorasi geospasial dan tabular (kombinasi angka konsentrasi assay, data diskrit litologi, dan koordinat spasial), literatur akademik global membuktikan **XGBoost secara konsisten mengungguli Deep Learning**. XGBoost tidak rentan overfitting pada data sampel bor yang terbatas, tidak membutuhkan komputasi GPU raksasa di lapangan, dan memiliki **explainability** tinggi sehingga geologist tahu persis alasan di balik tiap skor rekomendasi."*

---

### ❓ Tanya 2: *"Angka validasi 200.101 data dan $R^2 = 0,842$ itu dapet dari mana? Apakah data nyata atau simulasi?"*
> **Jawaban Anda**:
> *"Angka validasi 200.101 sel tersebut berasal dari **Spatial Block Hold-Out testing**. Total dataset kami mencakup 1.000.000 titik grid node yang dikompilasi dari benchmark regional sabuk ofiolit Sulawesi dan Halmahera (Sorowako, Pomalaa, Morowali, Weda Bay). Kami memisahkan Region Tenggara (SE) sebanyak 200.101 sel sebagai blind-test unseen data. Hasilnya menghasilkan $R^2 = 0,842$ dan korelasi ranking Spearman $\rho = 0,885$."*

---

### ❓ Tanya 3: *"Bagaimana jika di lapangan data geokimianya belum lengkap?"*
> **Jawaban Anda**:
> *"NiTERRA dirancang adaptif. Jika data geokimia tanah belum tersedia (tahap early greenfield), NiTERRA mengandalkan **Drone Magnetometry TMI + Indeks Multispektral Satelit Sentinel-2 (Fe-Oxide B4/B2 & Clay Index B11/B12)** untuk memandu survei rintisan awal. Begitu sampel geokimia atau data bor awal masuk, sistem langsung mengaktifkan pipeline data fusion penuh."*

---

### ❓ Tanya 4: *"Apakah AI ini akan menggantikan peran Chief Geologist ANTAM?"*
> **Jawaban Anda**:
> *"Sama sekali tidak. Filosofi NiTERRA adalah **Human-in-the-Loop Decision Support**. NiTERRA memangkas 95% waktu eliminasi area mandul (*waste ground*), menyaring ribuan hektar menjadi puluhan target prospektif terbaik beserta estimasi biaya bornya. Keputusan akhir eksekusi drilling tetap 100% berada di tangan Geologist ANTAM, namun kini didukung data kuantitatif yang defensif."*
