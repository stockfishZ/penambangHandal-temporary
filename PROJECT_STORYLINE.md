# 🗺️ NiTERRA: Cerita Lengkap Proyek Kita (Storyline for Team)
> **ANTAM Hackathon 2026 — Young Mining Innovators (Finalist Sprint)**  
> *Panduan Cepat & Ringkas untuk Lian, Rafa, Kevin & Tim Penambang Handal ITB*

---

## 💡 1. Cerita Singkat: Kenapa Proyek Ini Ada? (The Background Story)

Bayangkan kamu sedang mencari **harta karun** berupa nikel yang tersembunyi di dalam tanah di tengah hutan belantara Sulawesi atau Halmahera. 

* **Cara Lama (Eksplorasi Konvensional):**  
  Karena kamu tidak bisa melihat menembus tanah, cara satu-satunya adalah **mengebor tanah secara acak** (*blind drilling*). Pengeboran itu sangat mahal (bisa **Rp 1.000.000 per meter**!). Dari 100 lubang yang digali, seringkali **99 lubang bor ternyata kosong** (*dry holes*). Hasilnya: Waktu terbuang berbulan-bulan dan uang miliaran rupiah hangus sia-sia (*sunk cost*).

* **Solusi Kita (NiTERRA):**  
  Kita membuat **"Kacamata X-Ray Pintar & Navigasi AI"** untuk penambang. Sebelum bor disentuhkan ke tanah, NiTERRA sudah memberi tahu titik-titik mana yang **paling berpotensi mengandung nikel tinggi** dan **aman secara hukum (ESG)**.

---

## 🎯 2. Apa Tujuan Proyek Ini? (What's The Goal?)

1. **Tujuan Kompetisi:** Menang **Juara 1 & Golden Ticket** di ANTAM Hackathon 2026 (Unit Geomin).
2. **Tujuan Teknis & Bisnis:**
   * 🎯 **Mendongkrak Hit Rate Bor:** Dari cuma ~1% (menebak-nebak) naik drastis jadi **>40%** (presisi berbasis AI).
   * ⏱️ **Memangkas Waktu:** Dari analisis manual berminggu-minggu menjadi **hitungan menit/jam**.
   * 💰 **Menghemat Uang ANTAM:** Menyelamatkan puluhan titik bor steril, menghemat **ratusan juta hingga miliaran rupiah** per blok eksplorasi.

---

## 🔍 3. Bagaimana Cara Kerja NiTERRA? (How It Works)

NiTERRA bekerja seperti tim detektif yang menggabungkan 4 jenis petunjuk:

```
[ 🛰️ Satelit (Warna Tanah) ]  +  [ 🛸 Drone Magnetik (Retakan) ]
                                ⬇️
                 [ 🧠 Otak AI (XGBoost Engine) ]
                                ⬇️
[ 🛡️ Rem Otomatis Legal (Hutan Lindung) ] ➡️ [ 🖥️ Dashboard 2D/3D & Titik Bor Prioritas ]
```

### 4 Komponen Utama (Perumpamaan Sederhana):

1. **🛰️ Mata Satelit (Remote Sensing - Sentinel 2):**
   * *Perumpamaan:* Seperti kamera khusus yang memotret **"karat besi"** dan jenis tanah dari luar angkasa.
   * *Fungsinya:* Memetakan zona lapisan limonit (Fe-Oxide) dan lempung saprolit dari atas permukaan.

2. **🛸 Detektor Magnetik Drone (ESP32 Magnetometer Payload):**
   * *Perumpamaan:* Seperti pendeteksi logam terbang yang memotret **"urat & retakan tanah"**.
   * *Fungsinya:* Nikel laterit terbentuk karena air hujan meresap lewat retakan batuan induk (ultramafik). Magnetometer drone memetakan retakan (patahan/struktur) tersebut dari udara tanpa perlu membabat hutan.

3. **🧠 Otak AI (XGBoost Machine Learning):**
   * *Perumpamaan:* Seperti **"Koki Ahli"** yang mencampurkan semua bumbu (data satelit + magnetik + kemiringan lereng + geokimia).
   * *Fungsinya:* AI menghitung skor probabilitas 0-100% untuk setiap meter persegi lahan.

4. **🛡️ Rem Otomatis ESG & Legal (Masking No-Go Zone):**
   * *Perumpamaan:* Seperti **"Satpam Perizinan"** yang langsung berteriak: *"Stop! Meskipun nikelnya tebal, ini Hutan Lindung / Sempadan Sungai. Jangan bor di sini!"*

---

## ⚡ 4. Kenapa Metode Ini Manjur? (Why It Works)

* **Bukan Janji Palsu (Geologically Bulletproof):**  
  Kita tidak mengklaim magnetometer drone bisa "membaca kadar nikel" langsung. Magnetometer memetakan **struktur patahan & batuan induk**, sedangkan satelit memetakan **mineral permukaan**. Integrasi inilah yang membuat analisis kita diterima dan dipuji oleh senior geologist PT ANTAM.
* **Legal & ESG Protection:**  
  Banyak perusahaan tambang kena denda karena salah bor di kawasan Hutan Lindung. NiTERRA otomatis mengunci area terlarang dan langsung drafting dokumen perizinan (PPKH).
* **Teruji Secara Spesifik untuk Indonesia:**  
  Algoritma disesuaikan khusus untuk karakteristik nikel laterit iklim tropis Indonesia (Sulawesi & Halmahera).

---

## 🚀 5. Bagaimana Kita Sampai di Babak Final? (How We Got To The Goal)

```
[ Step 1: Ideasi ] ➡️ [ Step 2: Prototipe & Proposal ] ➡️ [ Step 3: Pengumuman Finalis ] ➡️ [ Step 4: Sprint Juara ]
```

1. **Step 1 — Ideasi (GeoNiRisk):** Awalnya kita ingin membuat analisis risiko lahan tambang.
2. **Step 2 — Prototipe & Proposal:** Kita kembangkan alat hardware ESP32 + WebGIS + Proposal 30.000+ kata (Proposal Penambang Handal) dan berhasil submit ke ANTAM.
3. **Step 3 — Pengumuman Finalis (Top 10):** Proposal kita lolos ke **BABAK FINAL!**
4. **Step 4 — Finalist Sprint (NiTERRA v2.0):**  
   Kita menyusun `FINALIST_ACTION_PLAN.md` untuk menyiapkan:
   * 📊 **15-Slide Presentation Deck** (Siap presentasi depan Direksi Geomin)
   * 🎬 **Video Pitch 2 Menit**
   * 🖥️ **WebGIS 2D & 3D Interactive Demo**
   * 🛡️ **Q&A Defense Matrix** (Menjawab pertanyaan sulit juri)

---

## 👥 Pembagian Peran Tim Penambang Handal ITB

* ⛏️ **Lian Ridzuan (Teknik Pertambangan):** Domain Expert Geologi, KCMI Code compliance, NPV/ROI Economics, & Pitching presentation.
* ⚡ **Rafa Satria Pratama (Teknik Elektro):** Hardware IoT ESP32 payload, drone integration, & Backend ML pipeline.
* 🌌 **Kevin Yuhan Wahyu Pratama (Teknik Geofisika):** Pemrosesan data TMI Magnetometer, remote sensing Sentinel-2, & 2D/3D WebGIS visualization.

---

*NiTERRA — Target Fast, Drill Smart, Zero Waste.*  
*Ready for Demo Day Victory!* 🏆
