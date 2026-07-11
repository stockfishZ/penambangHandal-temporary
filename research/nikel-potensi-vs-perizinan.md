# Nikel Laterit Indonesia: Potensi vs. Status Perizinan

## Kesimpulan Singkat

**82% deposit nikel Indonesia tumpang tindih dengan hutan alam.** Artinya, potensi besar "terkubur" di bawah zona hukum yang membatasi — bukan karena langka, tapi karena geologi nikel laterit terbentuk di batuan ultramafik yang juga merupakan tanah subur untuk hutan tropis.

## Data Tumpang Tindih

| Sumber | Temuan | Tahun |
|--------|--------|-------|
| **Auriga Nusantara** | 2,5 juta ha dari 3,1 juta ha deposit nikel tumpang tindih dengan hutan alam (**82%**) | 2025 |
| **IUCN NL** | 77% konsesi Morowali tumpang tindih dengan hutan hujan primer | 2025 |
| **Forest Watch Indonesia** | ~180.000 ha (90%) konsesi nikel Halmahera di kawasan hutan lindung/produksi | 2024 |
| **Earth Insight / Auriga** | >450.000 ha konsesi nikel tumpang tindih dengan hutan alam | 2023 |
| **Mighty Earth** | 329 konsesi: 20 konsesi punya >90% KBA (Key Biodiversity Area) di dalamnya | 2024 |
| **Dynamics of Land Transformation** | 53% deforestasi dalam konsesi nikel (2013–2022) adalah konversi hutan | 2025 |

## Kerangka Hukum — 3 Status Kawasan Hutan

### 1. APL (Areal Penggunaan Lain) — **Diizinkan**
- Bukan kawasan hutan negara
- IUP bisa diterbitkan langsung, tanpa PPKH
- Tidak ada restriksi kehutanan

### 2. HP/HPT/HPK (Hutan Produksi) — **Bersyarat (Conditional)**
- Izin dibutuhkan: **PPKH** (Pinjam Pakai Kawasan Hutan) via Permen LHK No. 7/2021
- Ada batasan: buffer zone 500m dari kawasan konservasi tidak boleh ditambang
- Wajib reklamasi, bayar PSDH-DR (Provisi Sumber Daya Hutan-Dana Reboisasi)
- Banyak perusahaan beroperasi di zona ini dengan PPKH (contoh: PT Vale Indonesia, PT Antam)

### 3. HL/HSA (Hutan Lindung / Suaka Alam) — **Larangan (No-Go)**
- UU No. 41/1999 melarang tambang terbuka di hutan lindung
- **Pengecualian**:
  - Hanya 13 perusahaan dengan Kontrak Karya era Orde Baru yang diizinkan via **Perpres No. 41/2004** jo. **Perpres No. 3/2023**
  - Termasuk: PT Vale Indonesia (Inco), PT Antam (2 site), PT Weda Bay Nickel, PT Gag Nikel
  - 13 ini adalah satu-satunya yang legal beroperasi di hutan lindung

## Implikasi untuk Skor ML

| Status | Skor Legal (Sekarang) | Frekuensi di Real Data | Dampak |
|--------|----------------------|----------------------|--------|
| allowed | 5.0 | ~20-30% area deposit | ML tinggi wajar |
| conditional | 3.0 | **~50-60% area deposit** | Skor turun drastis meski litologi ultramafik |
| no-go | 0 (masked) | **~10-20% area deposit** | Semua potensi diabaikan |

## Dilema: "Potensi Besar tapi Terkubur Hukum"

- **Pulau Gag, Raja Ampat**: Deposit nikel laterit signifikan di hutan lindung pulau kecil. PT Gag Nikel (Antam) dapat izin PPKH. Kontroversi lingkungan tinggi.
- **Morowali**: 52.000 ha (22% konsesi) di hutan lindung. Beberapa perusahaan operasi tanpa PPKH.
- **Halmahera**: 90% konsesi di kawasan hutan. Banyak IUP baru belum punya PPKH.
- **Konawe**: Beberapa perusahaan terbukti membuka hutan lindung tanpa izin (Mighty Earth data).

## Saran untuk Scoring ML

1. **Conditional (3.0) mungkin terlalu rendah**: Conditional bukan berarti tidak bisa ditambang — PPKH bisa diurus. Nilai 3.0 dari max 5.0 membuat sel conditional jarang tembus threshold "HIGH" (6.5). Usulan: naikkan ke 4.0–4.5.

2. **Faktor litologi dan akses seharusnya bisa "override" legal pada area conditional**: Banyak area ultramafik di HP/HPT yang akhirnya dapat PPKH (prosesnya administratif, bukan teknis). ML seharusnya tetap mengakui potensi geologi.

3. **No-go masking benar**: HL/HSA memang tidak bisa ditambang oleh perusahaan baru — hanya 13 CoW lama yang punya akses. Masking ke 0 sudah tepat untuk user non-13-exemption.

4. **Tambahkan metadata exemption**: Untuk completeness, ML bisa deteksi apakah user termasuk salah satu dari 13 CoW — jika iya, no-go pun jadi feasible.

## Sumber

- [IUCN NL — Morowali Report (2025)](https://www.iucn.nl/app/uploads/2025/07/Morowali-report-IUCN-NL-finale-versie-high-res.pdf)
- [Forest Watch Indonesia — Halmahera (2024)](https://fwi.or.id/en/nickel-mining-destroyer-of-halmaheras-forest/)
- [Mighty Earth — From Forests to Electric Vehicles (2024)](https://mightyearth.org/article/avoiding-forests-protecting-people-and-electrifying-vehicles/)
- [Auriga Nusantara — No Go Zone Wallacea (2025)](https://betahita.id/news/lipsus/10889/buat-zona-haram-eksploitasi-di-kawasan-wallacea-saran-auriga)
- [Earth Insight — COP28 Forest Threat Report (2023)](https://betahita.id/news/detail/9609/cop28-hutan-indonesia-terancam-tambang-nikel-dan-transisi-energi)
- [Atika et al. — Dynamics of Land Transformation (2025)](https://doi.org/10.1088/1748-9326/ae318f)
- [JIST — PPKH PT Nickel Indonesia (2025)](https://jist.publikasiindonesia.id/index.php/jist/article/view/1271)
