# PROPOSAL: NiTERRA - Platform Eksplorasi Cerdas Berbasis AI (ANTAM Hackathon 2026)

## 1. Problem Statement
Eksplorasi nikel konvensional seringkali memakan waktu berbulan-bulan dengan biaya capex yang sangat tinggi karena kurangnya optimalisasi penentuan titik bor. Selain itu, aspek tumpang tindih lahan (hutan lindung) dan risiko teknis/K3 di lapangan sulit diidentifikasi di awal.

## 2. Solusi: NiTERRA
NiTERRA adalah ekosistem hibrida yang memadukan integrasi spasial (GIS) dan machine learning (XGBoost) untuk memberikan rekomendasi area eksplorasi prioritas.

---

## 3. Rincian Fitur Mikro (Micro Features Breakdown)

### A. Pre-Survey ML Prospectivity (XGBoost Scoring)
- **Apa itu**: Model Machine Learning yang memberikan skor prospektivitas (0-10) pada grid area eksplorasi sebelum survei fisik.
- **Fungsi**: Memprioritaskan zona eksplorasi berdasarkan probabilitas geologi tanpa harus mengirim tim ke lapangan.
- **Korelasi dengan Hackathon**: Sesuai dengan Tema 1 (Eksplorasi) yang menuntut *targeting, prospectivity mapping*, dan pemanfaatan *AI/Data Analytics*.
- **Insight dari Riset**: Berdasarkan data historis, *82% deposit nikel Indonesia tumpang tindih dengan hutan alam*. Scoring ML ini memperhitungkan status kawasan hutan (APL/HP/HL) untuk menurunkan atau mematikan (masking) skor pada area yang dilarang (No-Go).
- **Manfaat**: Menghemat CAPEX dengan menghindari pengeboran di area yang secara legal tidak dapat ditambang atau secara geologi probabilitasnya rendah.
- **Implementasi (Proses & Mengapa Efektif)**: 
  **Sangat penting untuk dicatat bahwa ini BUKAN sekadar algoritma skoring heuristik biasa (seperti AHP atau weighted sum overlay).** Ini adalah *Machine Learning* sejati berbasis *Supervised Learning*. Sistem menelan puluhan ribu baris data tabular historis (seperti litologi, intensitas magnetik, jarak ke struktur geologi, dan elevasi) beserta label kadar nikel (Ni grade) aktual dari hasil pengeboran masa lalu (misalnya dari dataset Weda Bay). Data ini dilatih menggunakan algoritma **XGBoost (Extreme Gradient Boosting)** melalui pendekatan *Stochastic Forward Modeling*. XGBoost dipilih karena kemampuannya yang luar biasa dalam menangani korelasi non-linear yang sangat kompleks antar variabel geologi, serta kebal terhadap *missing values* yang lazim terjadi di data survei lapangan. Algoritma ini secara iteratif membangun ribuan *decision trees* yang saling mengoreksi *error* pohon sebelumnya (Gradient Descent). Proses ini menghasilkan model prediktif yang jauh melampaui kemampuan manusia dalam mengenali pola spasial multi-dimensi (misalnya, AI bisa mendeteksi bahwa anomali magnetik moderat *hanya* prospek jika dipadukan dengan kemiringan lereng 8 derajat pada litologi ultramafik, sebuah pola tersembunyi yang sulit dilihat geologis konvensional). Hasilnya adalah probabilitas target yang murni *data-driven*, empiris, dan bebas dari bias subjektif (tebakan) manusia.

### B. Interactive Exploration Map (WebGIS)
- **Apa itu**: Peta interaktif berbasis web yang menampilkan target eksplorasi, data geofisika, geokimia, dan batas kawasan.
- **Fungsi**: Visualisasi spasial interaktif untuk memudahkan geologis melihat korelasi antar data geografis dan target prioritas.
- **Korelasi dengan Hackathon**: Memenuhi kewajiban pemanfaatan **GIS** dan *dashboard WebGIS monitoring eksplorasi*.
- **Manfaat**: Memberikan pandangan makro secara cepat mengenai sebaran target potensial dan risiko geografis sekitarnya.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Diimplementasikan menggunakan *library* `Leaflet.js` pada *frontend*. Sistem mengambil data mentah berformat GeoJSON dan merendernya secara dinamis di atas kanvas web. Setiap sel grid digambar sebagai poligon vektor yang diberi warna sesuai rentang skor ML (merah untuk tinggi, biru untuk rendah). Pendekatan ini efektif karena `Leaflet` sangat ringan (lightweight) dan ramah perangkat seluler (*mobile-friendly*), sehingga bisa diakses langsung oleh tim di lapangan menggunakan tablet. Secara kognitif, manusia adalah makhluk visual; daripada membaca ratusan baris koordinat di Excel, para pengambil keputusan (manajemen) bisa secara instan melihat klaster spasial dari target-target potensial tinggi dan seberapa dekat target tersebut dengan infrastruktur yang ada atau hutan yang dilindungi.

### C. Multi-Layer Map Views (Priority, Magnet, Sample, Risk)
- **Apa itu**: Sistem *toggle* pada peta interaktif untuk menampilkan layer spesifik secara terpisah.
- **Fungsi**: Mengisolasi tampilan data (misalnya: hanya melihat anomali magnetik atau hanya melihat Peta Risiko).
- **Korelasi dengan Hackathon**: Mendukung *data quality report* dan visualisasi *peta risiko (Risk Management)* yang diminta pada kriteria.
- **Manfaat**: Mencegah penumpukan informasi (clutter) sehingga pengguna bisa fokus menganalisis satu variabel pada satu waktu.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Dibangun dengan mengelola beberapa lapisan elemen DOM dan memanipulasi *state visibility* CSS yang terikat pada instance peta Leaflet. Ketika pengguna menekan salah satu tab, aplikasi memicu fungsi JavaScript untuk menyembunyikan (*hide*) layer SVG saat ini dan memunculkan (*show*) layer parameter lain (seperti *heatmap* magnetik atau peta risiko K3). Proses ini bekerja dengan sempurna untuk presentasi karena meniru kapabilitas *software* berat seperti QGIS/ArcGIS, namun disederhanakan ke dalam antarmuka web sekali klik. Hal ini mencegah *cognitive overload* (kelebihan beban informasi kognitif) dan memungkinkan pengguna melakukan validasi silang (cross-reference) berbagai dimensi geologi dengan sangat mulus.

### D. 3D Block Model (Terrain & Elevation Analysis)
- **Apa itu**: Visualisasi topografi dan skor prospektivitas dalam ruang 3 dimensi yang interaktif (bisa diputar/di-*zoom*).
- **Fungsi**: Menganalisis korelasi antara kemiringan lereng (slope) dengan zona pembentukan laterit ideal.
- **Korelasi dengan Hackathon**: Menjawab output spesifik *model 2D/3D sederhana* pada Tema 1.
- **Manfaat**: Geometri nikel laterit sangat dipengaruhi oleh topografi (kemiringan 5°-15°). 3D view membantu validasi visual secara instan sebelum penerjunan drone.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Sistem mengekstrak koordinat sumbu X dan Y (Bujur/Lintang) dan memasangkannya dengan data sumbu Z (Data Elevasi/SRTM), ditambah dimensi keempat yakni warna yang mewakili skor prospektivitas ML atau kadar Ni rata-rata. Data matriks ini kemudian dilempar ke pustaka `Plotly.js` (menggunakan API `Scatter3D` atau `Surface`). Plotly merender objek ini melalui WebGL langsung di dalam *browser*, memungkinkan pergerakan rotasi, *zoom*, dan *panning* yang sangat halus tanpa perlu menginstal aplikasi *desktop* berat (seperti Datamine atau Surpac). Hal ini sangat vital karena endapan nikel laterit sangat dikontrol oleh topografi lereng (terbentuk ideal pada kemiringan tertentu). Visualisasi 3D memungkinkan ahli geologi senior memvalidasi target dari algoritma ML menggunakan akal sehat (*geological common sense*)—misalnya memastikan bahwa area berskor tinggi tidak berada di tebing curam di mana laterit pasti sudah tererosi habis.

### E. Auto-ESG & Permit Drafter
- **Apa itu**: Sistem *Generative AI* yang secara otomatis merangkai draf dokumen perizinan (AMDAL, UKL-UPL, atau PPKH).
- **Fungsi**: Mempercepat proses perizinan ketika grid target berada pada zona bersyarat (Hutan Produksi/HPT).
- **Korelasi dengan Hackathon**: Merupakan nilai tambah inovatif untuk aspek wajib **ESG, Safety, dan Risk Management**.
- **Insight dari Riset**: Riset menunjukkan ~50-60% area deposit berada di zona bersyarat yang mewajibkan Izin Pinjam Pakai Kawasan Hutan (PPKH). Fitur ini menjawab *bottleneck* "Potensi Besar tapi Terkubur Hukum".
- **Manfaat**: Menekan *lead time* perizinan, mengamankan nilai ESG dari tahap hulu, dan mendigitasi proses kepatuhan administratif.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Digerakkan oleh pohon logika (*logic tree*) JavaScript (dengan potensi integrasi *backend Generative AI* menggunakan LLM). Ketika sebuah grid dipilih, sistem mengekstrak metadata geografisnya (contoh: lokasi di "Hutan Produksi", berjarak 500m dari sungai, berada di zona kelerengan curam). Mesin templat kemudian secara dinamis menyuntikkan parameter-parameter ini ke dalam draf regulasi baku (seperti klausul standar PPKH atau mitigasi lingkungan). Selanjutnya, pustaka `html2pdf.js` mem- *parsing* struktur HTML DOM tersebut menjadi *canvas* dan mengonversinya menjadi dokumen PDF yang dapat diunduh langsung di sisi klien (*client-side*). Pendekatan ini sangat efektif karena mampu mendigitalkan dan mengotomasi *bottleneck* birokrasi. Daripada tim perizinan (*permit team*) memulai draf dari nol untuk setiap area target, mereka langsung mendapatkan draf spesifik-lokasi yang sudah 90% selesai, yang secara masif mempercepat alur kerja kepatuhan ESG.

### F. CAPEX Optimization & ROI Calculator
- **Apa itu**: Kalkulator waktu-nyata yang menghitung potensi penghematan biaya pengeboran.
- **Fungsi**: Menghitung seberapa banyak dana yang dihemat dengan melebarkan spasi bor (dari 50m ke 100m) pada zona dengan *confidence* ML yang tinggi.
- **Korelasi dengan Hackathon**: Sesuai dengan komponen penilaian *Dampak dan Manfaat* (estimasi *cost saving*).
- **Manfaat**: Menerjemahkan performa teknis (akurasi ML) menjadi *Business Value* (dalam bentuk Rupiah) yang langsung dipahami oleh manajemen.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Diimplementasikan sebagai fungsi JavaScript reaktif yang memantau output dari model ML. Fungsi ini menghitung *baseline cost* (dengan asumsi pengeboran grid buta merata pada spasi rapat 50m) lalu membandingkannya dengan *optimized cost* (pengeboran di spasi 100m, namun hanya difokuskan pada grid target peringkat atas berdasarkan ML). Selisih luasan ini kemudian dikalikan dengan biaya rata-rata pengeboran per meter, dan hasilnya disuntikkan secara dinamis ke dalam DOM HTML (ditampilkan sebagai angka Rupiah Miliaran). Fitur ini adalah "senjata utama" untuk keperluan *pitching*, karena secara elegan menjembatani kesenjangan antara teknis geosains dan finansial korporat. Manajemen tingkat atas (Board of Directors) umumnya tidak hanya peduli pada seberapa akurat posisi nikelnya, tetapi lebih peduli pada *seberapa banyak uang yang dihemat teknologi ini*. Kalkulator ini memberikan justifikasi finansial secara instan.

### G. Ranking Table & Detail Panel
- **Apa itu**: Tabel data yang mengurutkan grid target terbaik beserta panel detail parameter.
- **Fungsi**: Memberikan daftar target yang *actionable* (siap eksekusi) bagi tim operasional.
- **Korelasi dengan Hackathon**: Menghasilkan *daftar target bor prioritas* dan data *exportable* sesuai ekspektasi output.
- **Manfaat**: Tim lapangan tidak hanya menebak dari warna peta, tetapi mendapat *list* koordinat absolut yang bisa diunduh (CSV) untuk dimasukkan ke *waypoint* drone/GPS.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Mesin JavaScript memetakan (*mapping*) struktur data *Array JSON* yang berisi seluruh grid yang telah dianalisis, mengurutkannya (*sorting*) dari skor ML tertinggi ke terendah, lalu menyuntikkannya menjadi baris-baris `<tr>` dalam tabel HTML. Setiap baris dipasangi *Event Listeners*, sehingga jika pengguna mengklik sebuah baris, aplikasi akan menarik objek data tersebut ke *Detail Panel* di sebelah kanan (memperbarui badge UI dan teks spesifik). Terdapat juga fungsi ekspor yang mengonversi *Array JSON* ini menjadi format *Blob* CSV untuk diunduh. Proses ini krusial karena meskipun Peta (WebGIS) sangat bagus untuk *perencanaan strategis*, eksekusi lapangan selalu membutuhkan *daftar (lists)*. Operator lapangan dan pilot drone membutuhkan daftar koordinat absolut dan urutan prioritas yang tepat, menjadikan tabel ini jembatan sempurna antara fase "perencanaan" dan "eksekusi".

### H. Retrain Pipeline (Feedback Loop)
- **Apa itu**: Fitur untuk mengunggah data hasil pengeboran terbaru guna melatih ulang model AI.
- **Fungsi**: Terus meningkatkan akurasi model ML seiring dengan bertambahnya data lapangan (*continuous learning*).
- **Korelasi dengan Hackathon**: Sesuai dengan poin *Feasibility & Implementasi* untuk "roadmap pengembangan lanjut".
- **Manfaat**: Memastikan aplikasi relevan sepanjang umur tambang, bukan hanya alat analitik statis di awal proyek.
- **Implementasi (Proses & Mengapa Efektif)**: 
  Dalam prototipe ini, alur kerja didemonstrasikan melalui *upload event listener* yang ketika ditekan akan menyimulasikan kalibrasi ulang bobot fitur. Pada tahap produksi, tombol ini menembakkan permintaan HTTP POST berisi *file* CSV data *assay* (hasil lab pengeboran terbaru) ke server *backend* Python. Di sinilah letak inti dari sistem AI yang terus berkembang (*Continuous Machine Learning Pipeline*): Server akan memanggil fungsi `xgboost.train()` menggunakan dataset yang telah diperbarui (*transfer learning*/re-training), melakukan validasi silang (*k-fold cross-validation*) untuk memastikan tidak terjadi *overfitting*, menyimpan artefak `.model` terbaru, dan menyegarkan *endpoint* inferensi API secara *seamless* tanpa *downtime*. **Inilah yang membedakan AI dengan software biasa.** Model geologi tidak boleh statis. Jika model memprediksi kadar nikel tinggi (skor 9.5) namun hasil bor aktual ternyata "zonk" (kadar rendah), sistem *Retrain* ini memasukkan data kegagalan tersebut sebagai *Ground Truth* baru. XGBoost akan menghukum (*penalize*) parameter yang menyebabkan kesalahan prediksi tersebut pada iterasi berikutnya. Mekanisme umpan balik otomatis (*feedback loop*) inilah yang memastikan platform NiTERRA terus mengevolusi kecerdasannya (semakin sering mengebor, algoritma semakin akurat), menjadikannya aset perusahaan yang valuasinya terus terapresiasi seiring berjalannya waktu operasional tambang.

### I. Feature Importance Visualization (Insights)
- **Apa itu**: Bar chart interaktif yang menampilkan besaran bobot tiap parameter terhadap skor prediksi akhir.
- **Fungsi**: Memberikan transparansi (Explainable AI) tentang mengapa suatu area mendapat skor tinggi.
- **Korelasi dengan Hackathon**: Sangat membantu untuk mempertahankan asumsi saat *Presentasi dan tanya jawab* dengan dewan juri (kriteria bobot 10%).
- **Insight dari Riset**: Menjelaskan alasan mengapa *litologi* atau *jarak smelter* bisa menutupi defisit dari status *conditional forest*.
- **Manfaat**: Meningkatkan kepercayaan (trust) para ahli geologi konvensional terhadap output algoritma ML (menghilangkan sentimen *Black Box AI*).
- **Implementasi (Proses & Mengapa Efektif)**: 
  Fitur ini memanfaatkan manipulasi DOM murni untuk mengatur properti CSS `width` (lebar) pada elemen batang diagram. Nilai persentase lebar tersebut didapatkan dari metrik bawaan algoritma XGBoost (seperti nilai `gain` atau `weight`) yang menggambarkan seberapa besar kontribusi suatu parameter terhadap keputusan akhir model. Proses ini dengan cerdik menerjemahkan matriks probabilitas matematis yang rumit menjadi *bar chart* yang sederhana. Ini adalah solusi telak untuk menjawab masalah "Black Box" (kotak hitam) pada AI. Jika seorang geologis senior meragukan mengapa suatu area mendapat prioritas utama, grafik ini memberikan alasan logis matematis yang konkret (misalnya: "Ini karena probabilitas 40% didorong oleh litologi ultramafik, dan 30% didorong oleh kedekatannya dengan anomali magnetik"). Transparansi (Explainable AI) ini merupakan kunci mutlak untuk memenangkan kepercayaan (trust) dan adopsi *user* di industri konservatif seperti pertambangan.

---

## 4. Kesimpulan
NiTERRA bukan sekadar aplikasi WebGIS; ini adalah instrumen pengambil keputusan komprehensif yang menjembatani keilmuan geosains, *machine learning*, legal (ESG), dan keekonomian tambang. Solusi ini menjawab visi "Accelerating Future Mining" ANTAM dengan menekan CAPEX dan risiko, sekaligus mempercepat penemuan cadangan baru.
