let map;
let gridLayer;
let magnetLayer;
let sampleLayer;
let resultRows = [];
let rawMagnet = [];
let rawGeo = [];
let rawGrid = null;
let activeLayerMode = 'priority';
let gridLayers = {};
let detailZoomed = false;
let selectedGridId = null;

const weights = {
  magnetic: 0.24,
  geochemistry: 0.22,
  lithology: 0.16,
  slope: 0.10,
  road: 0.08,
  river: 0.07,
  legal: 0.08,
  smelter: 0.03,
  area: 0.02
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  if (typeof L === 'undefined') {
    setStatus('Map library belum kebaca', 'Leaflet JS gagal dimuat. Pastikan internet aktif karena basemap memakai CDN OpenStreetMap/Leaflet.');
  } else {
    initMap();
  }
  bindEvents();
  initAutoHideTopbar();
  drawFeatureBars();
  initScrollReveal();
  setTimeout(forceMapResize, 250);
  setTimeout(forceMapResize, 900);
});

function bindElements() {
  ['magFile','geoFile','gridFile','magFileName','geoFileName','gridFileName','loadDummyBtn','runBtn','retrainBtn','toggle3dBtn','close3dBtn','plotly3dContainer','plotlyDiv','roiSavings','statusBox','gridCount','priorityOneCount','avgScore','bestTarget','killZoneCount','grandfatheredCount','rankingBody','targetDetail','downloadBtn','featureBars','mapHint','targetDetailTitle','zoomDetailBtn'].forEach(id => {
    if (document.getElementById(id)) els[id] = document.getElementById(id);
  });
}
window.roiSavingsMiliar = 0;

function bindEvents() {
  els.magFile.addEventListener('change', () => updateFileName(els.magFile, els.magFileName));
  els.geoFile.addEventListener('change', () => updateFileName(els.geoFile, els.geoFileName));
  els.gridFile.addEventListener('change', () => updateFileName(els.gridFile, els.gridFileName));
  els.loadDummyBtn.addEventListener('click', loadDummyData);
  els.runBtn.addEventListener('click', runAnalysis);
  
  if (els.retrainBtn) {
    els.retrainBtn.addEventListener('click', async () => {
      els.retrainBtn.disabled = true;
      els.retrainBtn.textContent = 'Uploading & Training...';
      try {
        const formData = new FormData();
        if (els.magFile.files[0]) formData.append('file', els.magFile.files[0]);
        const res = await fetch(`${BACKEND_URL}/api/retrain`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Training already in progress or failed');
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`${BACKEND_URL}/api/retrain/status`);
            const statusData = await statusRes.json();
            if (!statusData.is_training) {
              clearInterval(poll);
              els.retrainBtn.textContent = 'Upload New Drill Data & Retrain';
              els.retrainBtn.disabled = false;
              setStatus('Retrain Complete', 'Model ML berhasil dilatih ulang dan di-load ke memory. Anda bisa run analysis lagi.');
            }
          } catch(e) {}
        }, 1000);
      } catch (e) {
        els.retrainBtn.disabled = false;
        els.retrainBtn.textContent = 'Upload New Drill Data & Retrain';
        setStatus('Error', e.message);
      }
    });
  }

  if (els.toggle3dBtn && els.close3dBtn) {
    els.toggle3dBtn.addEventListener('click', () => {
      els.plotly3dContainer.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      document.documentElement.style.overflow = 'hidden';
      // Give the browser time to render the container dimensions before Plotly calculates them
      setTimeout(() => {
        renderPlotly3D();
        if (window.Plotly) {
          try { Plotly.Plots.resize(document.getElementById('plotlyDiv')); } catch(e){}
        }
      }, 150);
    });
    els.close3dBtn.addEventListener('click', () => {
      els.plotly3dContainer.style.display = 'none';
      document.body.style.overflow = ''; // Restore background scrolling
      document.documentElement.style.overflow = '';
    });
  }

  els.downloadBtn.addEventListener('click', downloadResults);
  els.zoomDetailBtn.addEventListener('click', () => {
    detailZoomed = !detailZoomed;
    document.querySelector('.output-grid').classList.toggle('detail-expanded', detailZoomed);
    document.querySelector('.detail-panel').classList.toggle('expanded', detailZoomed);
    els.zoomDetailBtn.textContent = detailZoomed ? '✕' : '⛶';
    setTimeout(forceMapResize, 350);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLayerMode = btn.dataset.layer;
      renderMapLayers();
    });
  });
  window.addEventListener('resize', forceMapResize);
  window.addEventListener('orientationchange', () => setTimeout(forceMapResize, 450));
  window.addEventListener('hashchange', () => setTimeout(forceMapResize, 250));
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => setTimeout(forceMapResize, 650)));
}

function initAutoHideTopbar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const currentY = window.scrollY;
    const scrollingDown = currentY > lastY;
    const nearLandingTop = currentY < 90;

    if (nearLandingTop) {
      topbar.classList.remove('is-hidden');
    } else if (scrollingDown) {
      topbar.classList.add('is-hidden');
    } else {
      topbar.classList.remove('is-hidden');
    }

    lastY = Math.max(currentY, 0);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section').forEach(s => observer.observe(s));
}

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    preferCanvas: true,
    worldCopyJump: false
  }).setView([-3.44, 122.10], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const ro = new ResizeObserver(() => forceMapResize());
  ro.observe(document.getElementById('map'));
}

function forceMapResize() {
  if (!map) return;
  const el = document.getElementById('map');
  if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
    map.invalidateSize({ pan: false, animate: false });
  }
}

function updateFileName(input, target) {
  target.textContent = input.files?.[0]?.name || 'Belum dipilih';
}

function setStatus(title, text) {
  els.statusBox.innerHTML = `<b>${title}</b><span>${text}</span>`;
}

async function loadDummyData() {
  try {
    const [magText, geoText, gridJson] = await Promise.all([
      fetch('data/magnetometer_dummy.csv').then(r => r.text()),
      fetch('data/geochemistry_dummy.csv').then(r => r.text()),
      fetch('data/study_grid_dummy.geojson').then(r => r.json())
    ]);
    rawGrid = gridJson;
    rawGrid.features = rawGrid.features.slice(0, 40); // Limit to 40 grids to reduce lag
    const validIds = new Set(rawGrid.features.map(f => f.properties.grid_id));
    rawMagnet = parseCSV(magText).filter(r => validIds.has(r.grid_id));
    rawGeo = parseCSV(geoText).filter(r => validIds.has(r.grid_id));
    els.magFileName.textContent = 'magnetometer_dummy.csv';
    els.geoFileName.textContent = 'geochemistry_dummy.csv';
    els.gridFileName.textContent = 'study_grid_dummy.geojson';
    setStatus('Success', `Dummy data berhasil dimuat: ${rawMagnet.length} titik magnetometer, ${rawGeo.length} sampel, ${rawGrid.features.length} grid.`);
  } catch (err) {
    console.error(err);
    setStatus('Error', 'Dummy data gagal dimuat. Pastikan dibuka pakai Live Server, bukan double click file HTML.');
  }
}

async function readUploadedFiles() {
  if (!els.magFile.files[0] || !els.geoFile.files[0] || !els.gridFile.files[0]) return false;
  const [magText, geoText, gridText] = await Promise.all([
    els.magFile.files[0].text(),
    els.geoFile.files[0].text(),
    els.gridFile.files[0].text()
  ]);
  rawMagnet = parseCSV(magText);
  rawGeo = parseCSV(geoText);
  rawGrid = JSON.parse(gridText);
  return true;
}

async function runAnalysis() {
  try {
    if (!rawMagnet.length || !rawGeo.length || !rawGrid) {
      const hasUploaded = await readUploadedFiles();
      if (!hasUploaded) {
        setStatus('Data belum lengkap', 'Upload 3 file wajib atau klik Load Dummy Data dulu.');
        return;
      }
    }
    els.runBtn.classList.add('loading');
    setStatus('Processing', 'Menghitung scoring lokal dan mengirim ke backend ML...');

    // Precompute aggregations EXACTLY ONCE to fix N+1 / double aggregation CPU bottleneck
    const magByGrid = groupBy(rawMagnet, 'grid_id');
    const geoByGrid = groupBy(rawGeo, 'grid_id');
    const precomputed = {};
    rawGrid.features.forEach(f => {
      const gid = f.properties.grid_id || 'unknown';
      const mRows = magByGrid[gid] || [];
      const gRows = geoByGrid[gid] || [];
      precomputed[gid] = {
        mag_mean_nT: avg(mRows, 'mag_raw_nT'),
        mag_std_nT: std(mRows, 'mag_raw_nT'),
        Ni_pct_mean: avg(gRows, 'Ni_pct'),
        Fe_pct_mean: avg(gRows, 'Fe_pct'),
        Co_pct_mean: avg(gRows, 'Co_pct'),
        MgO_pct_mean: avg(gRows, 'MgO_pct'),
        SiO2_pct_mean: avg(gRows, 'SiO2_pct'),
      };
    });

    let backendData = null;
    try {
      backendData = await callBackendAnalyze(rawGrid.features, precomputed);
    } catch (err) {
      console.warn('Backend ML unavailable, using local scoring only:', err);
    }

    if (backendData?.results) {
      const mlMap = {};
      backendData.results.forEach(r => { if (r.grid_id) mlMap[r.grid_id] = r; });
      rawGrid.features.forEach(f => {
        const ml = mlMap[f.properties.grid_id];
        if (ml) {
          f.properties.ml_score = ml.ml_score;
          f.properties.ml_masked = ml.ml_masked;
          f.properties.ml_block_reason = ml.ml_block_reason;
          f.properties.ml_top_features = ml.ml_top_features;
          f.properties.ml_confidence = ml.ml_confidence;
          f.properties.ml_cv_score = ml.ml_cv_score;
          f.properties.is_grandfathered = ml.is_grandfathered;
          f.properties.kill_zone_exclusion = ml.kill_zone_exclusion;
          f.properties.viability_score = ml.viability_score;
          f.properties.qaqc_flags = ml.qaqc_flags || [];
        }
      });
    }

    resultRows = buildResults(rawGrid, precomputed);

    if (backendData?.results) {
      const firstMl = resultRows.find(r => r.ml_top_features?.length);
      if (firstMl) {
        drawFeatureBars(firstMl.ml_top_features);
      }
    }

    renderMapLayers();
    renderSummary();
    renderRanking();
    selectTarget(resultRows[0]?.grid_id);
    const mlNote = backendData ? ' + ML dari backend' : '';
    setStatus('Done', `${resultRows.length} grid berhasil dianalisis${mlNote}. Grid prioritas tampil di peta kanan dan tabel output.`);
    setTimeout(forceMapResize, 150);
    setTimeout(forceMapResize, 600);
    document.getElementById('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    setStatus('Error', err.message || 'Analisis gagal. Cek format kolom CSV dan GeoJSON.');
  } finally {
    els.runBtn.classList.remove('loading');
  }
}

function parseCSV(text) {
  const clean = text.trim().replace(/^\uFEFF/, '');
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter(Boolean);
  const headers = splitCSVLine(lines.shift()).map(h => h.trim());
  return lines.map(line => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      const v = (values[i] ?? '').trim();
      const n = Number(v);
      obj[h] = v !== '' && !Number.isNaN(n) ? n : v;
    });
    return obj;
  });
}

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function avg(arr, key) {
  const vals = arr.map(d => Number(d[key])).filter(v => Number.isFinite(v));
  return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
}

const BACKEND_URL = 'http://localhost:8001';

function generateEsgDraftClient(row) {
  const ni = row.Ni_avg || 0;
  const fe = row.Fe_avg || 0;
  const co = row.Co_avg || 0;
  const mgo = row.MgO_avg || 0;
  const sio2 = row.SiO2_avg || 0;
  const slope = row.slope_deg || 0;
  const riverDist = row.distance_to_river_m || 0;
  const roadDist = row.distance_to_road_m || 0;
  const smelterDist = row.distance_to_smelter_km || 0;
  const lith = row.lithology || 'Unknown';
  const legal = row.legal_status || 'unknown';
  const region = row.region_id || '-';
  const score = row.final_priority_score || 0;
  const risk = row.risk_score || 0;
  const mlScore = row.ml_score != null ? row.ml_score + '/10' : 'N/A';
  const safety = row.safety_level || 'Unknown';
  const safetyWarn = row.safety_warning || '-';
  const processing = row.processing_route || 'Unknown';
  const procDesc = row.processing_desc || '-';
  const compliance = row.compliance_status || '-';
  const permit = row.permit_required || '-';
  const legalRef = row.legal_reference || '-';
  const mitigation = row.mitigation_requirements || '-';
  const killZone = row.kill_zone_exclusion ? 'TERLARANG - Hutan Lindung' : 'Tidak';
  const grandfathered = row.is_grandfathered ? 'Ya - Anomali Sejarah' : 'Tidak';
  const viability = row.viability_score != null ? row.viability_score : 'N/A';
  const capexTotal = row.capex_total || 0;
  const capexMiliar = (capexTotal / 1000000000).toFixed(2);
  const holes = row.drill_hole_count || 0;
  const meters = row.drill_total_meter || 0;
  const spacing = row.drill_spacing || 50;
  const magScore = row.mag_score || 0;
  const geochemScore = row.geochem_score || 0;
  const lithScore = row.lithology_score || 0;
  const areaHa = row.area_ha || 0;
  const locLabel = row.location_label || ('Grid ' + row.grid_id);

  const riverStatus = riverDist < 200 ? 'KRITIS (< 200m)' : riverDist < 500 ? 'WASPADA (200-500m)' : 'AMAN (> 500m)';
  const slopeStatus = slope > 25 ? 'TINGGI' : slope > 15 ? 'SEDANG' : 'RENDAH';
  const niGrade = ni >= 1.5 ? 'TINGGI' : ni >= 0.8 ? 'SEDANG' : 'RENDAH';

  let s = '=================================================================\n          NI TERRA - ESG & PERMIT DRAFT GENERATOR\n=================================================================\nDibuat oleh: NiTERRA GenAI Drafting Agent (Client-Side)\nTarget Grid : ' + row.grid_id + '\nLokasi      : ' + locLabel + '\nRegion      : ' + region + '\n=================================================================\n\n1. IDENTITAS WILAYAH\n-----------------------------------------------------------------\nGrid ID          : ' + row.grid_id + '\nLitologi         : ' + lith + '\nKemiringan       : ' + slope + ' deg (Risiko ' + slopeStatus + ')\nJarak ke Sungai  : ' + riverDist + ' m (Status: ' + riverStatus + ')\nJarak ke Jalan   : ' + roadDist + ' m\nJarak ke Smelter : ' + smelterDist + ' km\nLuas Area        : ' + areaHa + ' ha\nKelas Prioritas  : ' + (row.priority_class || '-') + ' (Skor: ' + score + '/100)\n\n=================================================================\n\n2. STATUS LEGAL & PERIZINAN\n-----------------------------------------------------------------\nStatus Hukum      : ' + legal + '\nZona Legal        : ' + (row.legal_zone || '-') + '\nIzin Dibutuhkan   : ' + permit + '\nReferensi Hukum   : ' + legalRef + '\nKepatuhan         : ' + compliance + '\nMitigasi          : ' + mitigation + '\nKill Zone         : ' + killZone + '\nKeterlanjuran     : ' + grandfathered + '\nSkor Viabilitas   : ' + viability + '\n\n=================================================================\n\n3. KAJIAN LINGKUNGAN\n-----------------------------------------------------------------\nAnalisis Kemiringan Lereng:\n  - ' + slope + ' deg - Risiko ' + slopeStatus + '\n  - ' + (slope > 25 ? 'REKOMENDASI: Desain lereng bertingkat dengan geometri <25 derajat. Drainase terpadu wajib.' : slope > 15 ? 'REKOMENDASI: Pertimbangkan cut-off bench dan terasering. Saluran pengendali erosi.' : 'REKOMENDASI: Standar penambangan konvensional dapat diterapkan.') + '\n\nAnalisis Buffer Sungai:\n  - ' + riverDist + ' m dari badan sungai terdekat\n  - ' + (riverDist < 200 ? 'STATUS: KRITIS - Tidak memenuhi baku minimal 200m dari sempadan sungai. Diperlukan kajian hidrologi detail dan permohonan pengecualian khusus.' : riverDist < 500 ? 'STATUS: WASPADA - Berada dalam zona 500m. Diperlukan kajian dampak hidrologi.' : 'STATUS: AMAN - Melebihi buffer 200m. Kajian hidrologi standar mencukupi.') + '\n\nStatus Hutan:\n  - ' + (row.legal_zone === 'Hutan Lindung' ? 'ZONA TERLARANG - Tidak ada aktivitas tambang terbuka yang diizinkan berdasarkan UU 41/1999.' : row.legal_zone === 'Hutan Produksi' ? 'Hutan Produksi - Diperizinkan dengan PPKH. Wajib Rehabilitasi DAS rasio 1:1 dan pembayaran PNBP.' : 'Areal Penggunaan Lain (APL) - Diperizinkan dengan IUP. Wajib AMDAL/UKL-UPL.') + '\n\n=================================================================\n\n4. ANALISIS GEOKIMIA & PROSPEKTIVITAS\n-----------------------------------------------------------------\nGeokimia Rata-rata:\n  - Ni  : ' + ni + '% (Kadar ' + niGrade + ')\n  - Fe  : ' + fe + '%\n  - Co  : ' + co + '%\n  - MgO : ' + mgo + '%\n  - SiO2: ' + sio2 + '%\n\nSkor:\n  - Magnetik      : ' + magScore + '/100\n  - Geokimia      : ' + geochemScore + '/100\n  - Litologi      : ' + lithScore + '/100\n  - Risiko        : ' + risk + '/100\n\nRute Pengolahan :\n  - ' + processing + ' - ' + procDesc + '\n\nML Prospectivity:\n  - Skor ML       : ' + mlScore + '\n' + (row.ml_confidence != null ? '  - Confidence    : ' + (row.ml_confidence * 100).toFixed(0) + '%\n' : '') + (row.ml_primary ? '  - Status        : ML digunakan sebagai skor utama\n' : '') + (row.ml_masked ? '  - BLOKIR        : ' + (row.ml_block_reason || 'Alasan tidak diketahui') + '\n' : '') + '\n=================================================================\n\n5. KESELAMATAN (K3)\n-----------------------------------------------------------------\nLevel Risiko     : ' + safety + '\nPeringatan       : ' + safetyWarn + '\n\n=================================================================\n\n6. RENCANA ANGGARAN (CAPEX)\n-----------------------------------------------------------------\nSpasi Bor          : ' + spacing + ' m x ' + spacing + ' m\nJumlah Lubang Bor  : ' + holes + '\nTotal Meter Bor    : ' + meters + ' m\nEstimasi Biaya     : Rp ' + capexMiliar + ' Miliar\nROI Savings (AI)   : Rp ' + (window.roiSavingsMiliar || '0') + ' Miliar\n\n=================================================================\n\n7. KESIMPULAN & REKOMENDASI\n-----------------------------------------------------------------\n';
  if (killZone.includes('TERLARANG')) {
    s += 'WILAYAH INI BERADA DI ZONA TERLARANG (HUTAN LINDUNG). Tidak direkomendasikan untuk eksplorasi lanjutan.\n';
  } else if (grandfathered.includes('Ya')) {
    s += 'WILAYAH INI MERUPAKAN KONSESI KETERLANJURAN. Diperlukan verifikasi hukum mendalam dengan Kantor Wilayah KLHK setempat sebelum melanjutkan.\n';
  } else if (score >= 80) {
    s += 'PRIORITAS TINGGI. Wilayah ini memiliki prospek sangat baik. Disarankan untuk segera mengajukan perizinan yang diperlukan dan melanjutkan ke tahap eksplorasi detail (Drilling).\n';
  } else if (score >= 62) {
    s += 'PRIORITAS MENENGAH. Prospek cukup baik namun memerlukan verifikasi lapangan tambahan sebelum komitmen penuh.\n';
  } else if (score >= 45) {
    s += 'PRIORITAS RENDAH. Data belum cukup meyakinkan. Pertimbangkan untuk digabung dengan area prioritas lebih tinggi.\n';
  } else {
    s += 'BUKAN PRIORITAS. Skor terlalu rendah untuk direkomendasikan.\n';
  }
  s += '\nRekomendasi Tambahan:\n';
  if (permit.includes('DILARANG')) {
    s += '- Wilayah ini tidak dapat dipertimbangkan untuk tambang terbuka.\n- Alihkan upaya ke area dengan status legal yang memungkinkan.\n';
  } else if (permit.includes('PPKH')) {
    s += '- Segera ajukan PPKH ke KLHK (Kementerian Lingkungan Hidup dan Kehutanan).\n- Siapkan dokumen AMDAL atau UKL-UPL.\n- Hitung PNBP dan biaya Rehabilitasi DAS.\n';
  } else if (permit.includes('IUP')) {
    s += '- Proses IUP melalui BKPM/Dinas ESDM setempat.\n- Siapkan studi AMDAL/UKL-UPL.\n- Konsultasi awal dengan Dinas Lingkungan Hidup.\n';
  } else {
    s += '- Verifikasi perizinan dengan otoritas setempat.\n';
  }
  s += '\n=================================================================\nDokumen ini digenerate secara otomatis oleh NiTERRA System.\nStatus: CLIENT-SIDE DRAFT (tanpa backend GenAI).\nTidak mengikat secara hukum. Verifikasi dengan ahlinya.\n=================================================================';
  return s;
}

function norm(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function std(arr, key) {
  const vals = arr.map(d => Number(d[key])).filter(v => Number.isFinite(v));
  if (vals.length < 2) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

async function callBackendAnalyze(features, precomputed) {
  const grids = features.map(f => {
    const p = f.properties || {};
    const gid = p.grid_id;
    const stats = precomputed[gid] || {};
    const coords = f.geometry?.coordinates?.[0]?.[0] || [];
    return {
      grid_id: gid,
      latitude: coords[1] || 0,
      longitude: coords[0] || 0,
      magnetometer_value: stats.mag_mean_nT || 0,
      geochemistry_value: stats.Ni_pct_mean || 0,
      slope_deg: Number(p.slope_deg) || 0,
      distance_to_river_m: Number(p.distance_to_river_m) || 0,
      distance_to_road_m: Number(p.distance_to_road_m) || 0,
      distance_to_smelter_km: Number(p.distance_to_smelter_km) || 0,
      area_ha: Number(p.area_ha) || 0,
      Ni_pct_mean: stats.Ni_pct_mean || 0,
      Fe_pct_mean: stats.Fe_pct_mean || 0,
      Co_pct_mean: stats.Co_pct_mean || 0,
      MgO_pct_mean: stats.MgO_pct_mean || 0,
      SiO2_pct_mean: stats.SiO2_pct_mean || 0,
      mag_mean_nT: stats.mag_mean_nT || 0,
      mag_std_nT: stats.mag_std_nT || 0,
      lithology: p.lithology || 'unknown',
      legal_status: p.legal_status || 'unknown',
    };
  });

  const response = await fetch(`${BACKEND_URL}/api/analyze-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grids }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Backend analysis failed (${response.status}): ${err}`);
  }

  return await response.json();
}

function scoreSlope(slope) {
  if (slope <= 15) return 100;
  if (slope <= 25) return 75;
  if (slope <= 35) return 45;
  return 15;
}
function scoreRoad(d) {
  if (d <= 500) return 100;
  if (d <= 1500) return 80;
  if (d <= 3000) return 55;
  return 25;
}
function scoreRiver(d) {
  if (d < 100) return 20;
  if (d < 300) return 55;
  if (d < 900) return 92;
  return 80;
}
function scoreLegal(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('allowed')) return 100;
  if (s.includes('conditional')) return 55;
  if (s.includes('no')) return 0;
  return 45;
}
function scoreSmelter(km) {
  if (km <= 50) return 100;
  if (km <= 90) return 80;
  if (km <= 140) return 55;
  return 30;
}
function scoreLithology(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('ultramafic') || s.includes('serpentinite') || s.includes('peridotite') || s.includes('harzburgite') || s.includes('dunite')) return 100;
  if (s.includes('mafic') || s.includes('basalt')) return 55;
  return 20;
}
function priorityClass(score) {
  if (score >= 80) return 'Prioritas 1';
  if (score >= 62) return 'Prioritas 2';
  if (score >= 45) return 'Prioritas 3';
  return 'Tidak prioritas';
}
function priorityKey(cls) {
  if (cls === 'Prioritas 1') return 'p1';
  if (cls === 'Prioritas 2') return 'p2';
  if (cls === 'Prioritas 3') return 'p3';
  return 'p4';
}
function priorityColor(cls, mode = 'fill') {
  const key = priorityKey(cls);
  const colors = { p1: '#10b981', p2: '#f59e0b', p3: '#f97316', p4: '#ef4444' };
  return colors[key];
}

function formatRupiah(n) {
  if (!Number.isFinite(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function computeCapex(row) {
  // Use ML cv_score, confidence, grid_score, or local final_score for spacing determination
  const cvScore = row.ml_cv_score;
  const conf = row.ml_confidence;
  const gridScore = row.ml_score;
  const finalScore = row.final_score;
  const highConf = (cvScore != null && cvScore >= 0.5) || 
                   (conf != null && conf >= 0.70) || 
                   (gridScore != null && gridScore >= 7.0) || 
                   (finalScore != null && finalScore >= 62);
  const spacing = highConf ? 100 : 50;
  const areaM2 = (row.area_ha || 0) * 10000;
  const holes = Math.ceil(areaM2 / (spacing * spacing));
  const meterage = holes * 25; // standard 25m depth
  const cost = meterage * 1000000; // Rp 1.000.000/m
  return { drill_spacing: spacing, estimated_drill_holes: holes, total_meterage: meterage, estimated_cost_rp: cost };
}

function deriveCompliance(legalStatus, isGrandfathered) {
  const s = (legalStatus || '').toLowerCase();
  if (isGrandfathered) {
    return {
      legal_zone: 'Hutan Produksi',
      permit_required: 'PPKH (Persetujuan Penggunaan Kawasan Hutan)',
      legal_reference: 'PP 23/2021',
      mitigation_requirements: 'Wajib PPKH, pembayaran PNBP, dan Rehabilitasi DAS rasio 1:1',
      compliance_status: 'ANOMALI SEJARAH: Konsesi Keterlanjuran. Tidak layak di bawah regulasi 2026.',
      is_grandfathered: true,
      kill_zone_exclusion: false,
      viability_score: 0.0
    };
  }
  if (s.includes('no')) {
    return {
      legal_zone: 'Hutan Lindung',
      permit_required: 'DILARANG',
      legal_reference: 'UU 41/1999',
      mitigation_requirements: 'Dilarang keras untuk tambang terbuka. Tidak ada izin.',
      compliance_status: 'ZONA TERLARANG: Hutan Lindung. Dilarang menambang.',
      is_grandfathered: false,
      kill_zone_exclusion: true,
      viability_score: 0.0
    };
  }
  if (s.includes('conditional')) {
    return {
      legal_zone: 'Hutan Produksi',
      permit_required: 'PPKH (Persetujuan Penggunaan Kawasan Hutan)',
      legal_reference: 'PP 23/2021',
      mitigation_requirements: 'Wajib PPKH, pembayaran PNBP, dan Rehabilitasi DAS rasio 1:1',
      compliance_status: 'Kawasan Hutan: Wajib izin PPKH dan Rehabilitasi DAS.',
      is_grandfathered: false,
      kill_zone_exclusion: false,
      viability_score: 42.5
    };
  }
  if (s.includes('allowed')) {
    return {
      legal_zone: 'Areal Penggunaan Lain',
      permit_required: 'IUP (AMDAL/UKL-UPL)',
      legal_reference: 'UU 3/2020; PP 96/2021',
      mitigation_requirements: 'Wajib studi AMDAL atau UKL-UPL',
      compliance_status: 'APL: Wajib izin IUP. Proses AMDAL standar berlaku.',
      is_grandfathered: false,
      kill_zone_exclusion: false,
      viability_score: 85.0
    };
  }
  return {
    legal_zone: 'Tidak Diketahui',
    permit_required: 'Verifikasi izin',
    legal_reference: 'UU 3/2020; PP 96/2021',
    mitigation_requirements: 'Verifikasi izin dengan otoritas lokal',
    compliance_status: 'Verifikasi tata ruang dengan KLHK/BIG.',
    is_grandfathered: false,
    kill_zone_exclusion: false,
    viability_score: 50.0
  };
}

function deriveProcessingRoute(ni, fe, co) {
  if (ni >= 1.5 && fe < 30) return { route: 'RKEF (Stainless Steel)', desc: 'Saprolite ore (High Ni, Low Fe)' };
  if (ni >= 0.8 && fe >= 30) return { route: 'HPAL (EV Battery)', desc: 'Limonite ore (High Fe/Co)' };
  if (ni >= 0.8 && fe < 30) return { route: 'Transition', desc: 'Transition zone (Blend required)' };
  return { route: 'Waste / Sub-economic', desc: 'Below cut-off grade' };
}

function deriveSafetyRisk(slope, distRoad) {
  if (slope > 25 && distRoad > 2000) {
    return { level: 'High (Red)', warning: 'Extreme landslide risk & poor medevac access. Requires winch/heli support and K3 rescue plan.' };
  } else if (slope > 15 || distRoad > 2000) {
    return { level: 'Moderate (Yellow)', warning: 'Standard 4x4 access restricted. Extra caution for slope stability.' };
  } else {
    return { level: 'Low (Green)', warning: 'Standard safety protocols apply. Good road access.' };
  }
}

function buildResults(grid, precomputed) {
  if (!grid || !Array.isArray(grid.features)) throw new Error('GeoJSON grid tidak valid.');
  
  const magMeans = grid.features.map(f => {
    const stats = precomputed[f.properties.grid_id] || {};
    return stats.mag_mean_nT || 0;
  });
  const magMin = Math.min(...magMeans.filter(Number.isFinite));
  const magMax = Math.max(...magMeans.filter(Number.isFinite));

  const results = grid.features.map((feature, idx) => {
    const p = feature.properties || {};
    const gridId = p.grid_id || `G${String(idx + 1).padStart(3, '0')}`;
    
    const stats = precomputed[gridId] || {};
    const magMean = stats.mag_mean_nT || 0;
    const magScore = norm(magMean, magMin, magMax);
    const ni = stats.Ni_pct_mean || 0;
    const fe = stats.Fe_pct_mean || 0;
    const co = stats.Co_pct_mean || 0;
    const mgo = stats.MgO_pct_mean || 0;
    const sio2 = stats.SiO2_pct_mean || 0;
    const magStd = stats.mag_std_nT || 0;
    const geochemScore = Math.max(0, Math.min(100, (ni / 2.1) * 58 + (mgo / 22) * 22 + ((45 - Math.min(sio2, 45)) / 45) * 10 + ((40 - Math.min(fe, 40)) / 40) * 10));
    const lithScore = scoreLithology(p.lithology);
    const slopeScore = scoreSlope(Number(p.slope_deg));
    const roadScore = scoreRoad(Number(p.distance_to_road_m));
    const riverScore = scoreRiver(Number(p.distance_to_river_m));
    const legalScore = scoreLegal(p.legal_status);
    const smelterScore = scoreSmelter(Number(p.distance_to_smelter_km));
    const areaScore = Math.max(20, Math.min(100, (Number(p.area_ha) / 180) * 100));

    let finalScore =
      weights.magnetic * magScore +
      weights.geochemistry * geochemScore +
      weights.lithology * lithScore +
      weights.slope * slopeScore +
      weights.road * roadScore +
      weights.river * riverScore +
      weights.legal * legalScore +
      weights.smelter * smelterScore +
      weights.area * areaScore;

    if (legalScore === 0) finalScore = Math.min(finalScore, 34);
    finalScore = Math.round(finalScore * 10) / 10;
    const mlPrimary = p.ml_score != null && !p.ml_masked;
    if (mlPrimary) finalScore = Math.round(p.ml_score * 10);
    const cls = priorityClass(finalScore);
    const riskScore = Math.round((100 - ((slopeScore + roadScore + riverScore + legalScore) / 4)) * 10) / 10;

    const compliance = deriveCompliance(p.legal_status, p.is_grandfathered);
    const processing = deriveProcessingRoute(ni, fe, co);
    const safety = deriveSafetyRisk(Number(p.slope_deg), Number(p.distance_to_road_m));

    const reason = buildReason({cls, magScore, ni, geochemScore, slope: p.slope_deg, road: p.distance_to_road_m, river: p.distance_to_river_m, legal: p.legal_status, lithology: p.lithology, final_priority_score: finalScore});

    const capex = computeCapex({
      ml_cv_score: p.ml_cv_score,
      ml_confidence: p.ml_confidence,
      ml_score: p.ml_score,
      final_score: finalScore,
      area_ha: Number(p.area_ha)
    });

    const capexSentenceStr = capex.drill_spacing === 50
      ? 'Variasi magnetik tinggi/ML score marginal, direkomendasikan spasi rapat (50m) untuk de-risking.'
      : 'Anomali seragam dan ML score tinggi, spasi lebar (100m) memadai untuk initial discovery.';

    feature.properties = {
      ...p,
      grid_id: gridId,
      mag_mean: Math.round(magMean * 10) / 10,
      mag_score: Math.round(magScore * 10) / 10,
      mag_std: Math.round(magStd * 100) / 100,
      Ni_avg: Math.round(ni * 100) / 100,
      Fe_avg: Math.round(fe * 100) / 100,
      Co_avg: Math.round(co * 100) / 100,
      MgO_avg: Math.round(mgo * 100) / 100,
      SiO2_avg: Math.round(sio2 * 100) / 100,
      geochem_score: Math.round(geochemScore * 10) / 10,
      lithology_score: lithScore,
      final_priority_score: finalScore,
      risk_score: riskScore,
      priority_class: cls,
      reason: reason + ' ' + capexSentenceStr,
      ml_primary: mlPrimary,
      processing_route: processing.route,
      processing_desc: processing.desc,
      safety_level: safety.level,
      safety_warning: safety.warning,
      qaqc_flags: p.qaqc_flags || [],
      ...compliance,
      ...capex,
      capex_reason: capexSentenceStr
    };
    return feature.properties;
  });

  results.sort((a,b) => b.final_priority_score - a.final_priority_score);
  grid.features.sort((a,b) => b.properties.final_priority_score - a.properties.final_priority_score);
  return results;
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function buildReason(d) {
  const parts = [];
  if (d.magScore >= 70) parts.push('anomali magnetik relatif tinggi');
  if (d.ni >= 1.5) parts.push('Ni rata-rata cukup baik');
  if (String(d.lithology || '').toLowerCase().includes('serpent') || String(d.lithology || '').toLowerCase().includes('ultra')) parts.push('litologi mendukung nikel laterit');
  if (Number(d.slope) <= 25) parts.push('slope masih feasible');
  if (Number(d.road) <= 1800) parts.push('akses jalan cukup dekat');
  if (Number(d.river) < 250) parts.push('perlu mitigasi karena dekat sungai');
  if (String(d.legal || '').toLowerCase().includes('conditional')) parts.push('legalitas conditional');
  if (String(d.legal || '').toLowerCase().includes('no-go')) parts.push('area masuk kawasan lindung — tidak feasible untuk tambang');
  if (d.ni < 0.5) parts.push('kadar Ni rendah, perlu kajian ekonomis lanjutan');
  if (d.cls === 'Tidak prioritas') parts.push('skor prioritas rendah, tidak direkomendasikan untuk pengeboran awal');
  if (Number(d.slope) > 25) parts.push('kemiringan lereng curam');
  if (Number(d.road) > 3000) parts.push('akses jalan jauh, biaya logistik tinggi');
  if (!parts.length) parts.push('perlu validasi lanjutan karena parameter utama belum dominan');
  return parts.join(', ') + '.';
}

function renderMapLayers() {
  if (!map) return;
  forceMapResize();
  [gridLayer, magnetLayer, sampleLayer].forEach(layer => { if (layer) map.removeLayer(layer); });
  gridLayer = null; magnetLayer = null; sampleLayer = null;

  if (!rawGrid || !rawGrid.features?.length) return;

  gridLayer = L.geoJSON(rawGrid, {
    style: feature => gridStyle(feature),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(popupContent(p));
      layer.on('click', () => selectTarget(p.grid_id));
      layer.on('mouseover', () => { if (layer !== gridLayers[selectedGridId]) layer.setStyle({ weight: 2.5, opacity: 1, fillOpacity: 0.75 }); });
      layer.on('mouseout', () => { if (layer !== gridLayers[selectedGridId]) layer.setStyle(gridStyle(feature)); });
    }
  });

  magnetLayer = L.layerGroup(rawMagnet.map(r => {
    const lat = Number(r.latitude); const lon = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return L.circleMarker([lat, lon], {
      radius: activeLayerMode === 'magnet' ? 7 : 4,
      color: '#07140f',
      weight: 1,
      fillColor: '#0ea5e9',
      fillOpacity: activeLayerMode === 'magnet' ? 0.9 : 0.55
    }).bindPopup(`<b>${r.point_id}</b><br>Grid: ${r.grid_id}<br>Mag raw: ${r.mag_raw_nT} nT`);
  }).filter(Boolean));

  sampleLayer = L.layerGroup(rawGeo.map(r => {
    const lat = Number(r.latitude); const lon = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return L.circleMarker([lat, lon], {
      radius: activeLayerMode === 'samples' ? 7 : 4,
      color: '#07140f',
      weight: 1,
      fillColor: '#fbbf24',
      fillOpacity: activeLayerMode === 'samples' ? 0.95 : 0.58
    }).bindPopup(`<b>${r.sample_id}</b><br>Grid: ${r.grid_id}<br>Ni: ${r.Ni_pct}%<br>Fe: ${r.Fe_pct}%`);
  }).filter(Boolean));

  gridLayer.addTo(map);
  gridLayers = {};
  gridLayer.eachLayer(layer => {
    const gid = layer.feature?.properties?.grid_id;
    if (gid) { gridLayers[gid] = layer; layer.bindTooltip(gid, { permanent: true, direction: 'center', className: 'grid-label' }); }
  });
  if (selectedGridId && gridLayers[selectedGridId]) {
    gridLayers[selectedGridId].setStyle({ weight: 3, color: '#fff', fillOpacity: 0.85 });
  }
  if (activeLayerMode === 'magnet') magnetLayer.addTo(map);
  if (activeLayerMode === 'samples') sampleLayer.addTo(map);
  if (activeLayerMode === 'priority') {
    magnetLayer.addTo(map);
    sampleLayer.addTo(map);
  }

  const bounds = gridLayer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.18));
  if (els.mapHint) els.mapHint.style.display = 'none';
  setTimeout(forceMapResize, 60);
  setTimeout(forceMapResize, 350);
}

function renderPlotly3D() {
  if (!resultRows.length || !window.Plotly) return;
  const active = resultRows.filter(r => !r.ml_masked);
  const x = active.map(r => {
    const f = rawGrid.features.find(feat => feat.properties.grid_id === r.grid_id);
    return f?.geometry?.coordinates?.[0]?.[0]?.[0] || 0;
  });
  const y = active.map(r => {
    const f = rawGrid.features.find(feat => feat.properties.grid_id === r.grid_id);
    return f?.geometry?.coordinates?.[0]?.[0]?.[1] || 0;
  });
  const z = active.map(r => r.ml_score != null ? r.ml_score : (r.final_priority_score/10));
  const c = active.map(r => r.Ni_avg || 0);
  const text = active.map(r => `Grid: ${r.grid_id}<br>Ni Avg: ${r.Ni_avg}%<br>Score: ${r.ml_score != null ? r.ml_score : (r.final_priority_score/10)}`);

  const trace = {
    x: x, y: y, z: z,
    mode: 'markers',
    marker: {
      size: 12,
      color: c,
      colorscale: 'Viridis',
      opacity: 0.9,
      colorbar: { title: 'Ni Avg (%)' }
    },
    text: text,
    hoverinfo: 'text',
    type: 'scatter3d'
  };
  const layout = {
    title: 'Model Blok 3D - Target Eksplorasi',
    dragmode: 'turntable',
    scene: {
      xaxis: { title: 'Longitude' },
      yaxis: { title: 'Latitude' },
      zaxis: { title: 'Prioritas (Lebih tinggi = lebih baik)' },
      bgcolor: '#0f172a',
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.5 }
      }
    },
    paper_bgcolor: '#0f172a',
    font: { color: '#e2e8f0' },
    margin: { l: 0, r: 0, b: 0, t: 40 }
  };
  const config = {
    responsive: true,
    scrollZoom: true,
    displayModeBar: true
  };
  Plotly.newPlot('plotlyDiv', [trace], layout, config);
}

function gridStyle(feature) {
  const p = feature.properties || {};
  if (p.ml_masked) {
    return { color: '#666', weight: 1, fillColor: '#888', fillOpacity: 0.15 };
  }
  let fill = priorityColor(p.priority_class || 'Prioritas 3');
  if (activeLayerMode === 'magnet') fill = colorRamp(p.mag_score || 0);
  else if (activeLayerMode === 'samples') fill = colorRamp((p.Ni_avg || 0) / 2.2 * 100);
  else if (activeLayerMode === 'risk') {
    const v = p.risk_score || 0;
    if (v >= 65) fill = '#ef4444'; // High Risk (Red)
    else if (v >= 35) fill = '#f59e0b'; // Med Risk (Yellow)
    else fill = '#10b981'; // Low Risk (Green)
  }
  return {
    color: '#fff9e8',
    weight: 1.6,
    opacity: 0.95,
    fillColor: fill,
    fillOpacity: 0.64
  };
}

function colorRamp(v) {
  const val = Number(v) || 0;
  if (val >= 75) return '#10b981';
  if (val >= 55) return '#f59e0b';
  if (val >= 35) return '#f97316';
  return '#ef4444';
}

function popupContent(p) {
    const label = p.kill_zone_exclusion ? '<span style="color:#ef4444;">⛔ TERLARANG</span>'
    : p.is_grandfathered ? '<span style="color:#f59e0b;">⚠️ KETERLANJURAN</span>'
    : '<span style="color:#10b981;">✓ AMAN</span>';
  const mlLine = p.ml_score !== undefined && p.ml_score !== null
    ? `<span>ML Score:</span><b>${p.ml_masked ? 'BLOCKED' : p.ml_score + '/10'}</b>`
    : '';
  return `
    <div class="popup-title">${p.grid_id} · ${p.priority_class || '-'}</div>
    <div class="popup-grid">
      <span>Score:</span><b>${p.final_priority_score ?? '-'}</b>
      <span>Risk (Uncertainty):</span><b>${p.risk_score ?? '-'}</b>
      <span>Ni avg:</span><b>${p.Ni_avg ?? '-'}%</b>
      <span>Slope:</span><b>${p.slope_deg ?? '-'}°</b>
      <span>Legal:</span><b>${p.legal_zone || '-'}</b>
      <span>Compliance:</span>${label}
      ${mlLine}
    </div>`;
}

function animateCounter(el, target, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const duration = 800;
  const from = 0;
  const animate = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = suffix ? current + suffix : current;
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function renderSummary() {
  const active = resultRows.filter(r => !r.ml_masked);
  const n = active.length;
  const total = resultRows.length;
  const p1 = active.filter(r => r.priority_class === 'Prioritas 1').length;
  const avg = n ? Math.round(active.reduce((a,b) => a + b.final_priority_score, 0) / n) : 0;
  const killZones = resultRows.filter(r => r.kill_zone_exclusion).length;
  const grandfathered = resultRows.filter(r => r.is_grandfathered).length;
  const masked = resultRows.filter(r => r.ml_masked).length;
  animateCounter(els.gridCount, n);
  els.gridCount.parentElement.querySelector('span').textContent = `Grid aktif (${masked} diblokir)`;
  animateCounter(els.priorityOneCount, p1);
  animateCounter(els.avgScore, avg);
  els.bestTarget.textContent = resultRows[0]?.grid_id || '—';
  els.killZoneCount.textContent = killZones;
  els.grandfatheredCount.textContent = grandfathered;

  let baselineTotal = 0;
  let aiTotal = 0;
  resultRows.forEach(r => {
      const areaM2 = (r.area_ha || 10) * 10000;
      const baselineHoles = Math.ceil(areaM2 / (50 * 50));
      baselineTotal += baselineHoles * 25 * 1000000;
      aiTotal += r.estimated_cost_rp || 0;
  });
  const savings = Math.max(0, baselineTotal - aiTotal);
  window.roiSavingsMiliar = (savings / 1000000000).toFixed(2);
  if (els.roiSavings) els.roiSavings.textContent = `Rp ${window.roiSavingsMiliar} M`;
}

function renderRanking() {
  if (!resultRows.length) return;
  const maxScore = Math.max(...resultRows.map(r => r.final_priority_score));
  els.rankingBody.innerHTML = resultRows.map((r, i) => {
    const barW = maxScore > 0 ? (r.final_priority_score / maxScore) * 100 : 0;
    const pKey = priorityKey(r.priority_class);
    const barColor = { p1: '#10b981', p2: '#f59e0b', p3: '#f97316', p4: '#ef4444' }[pKey] || '#10b981';
    const mlBadge = r.ml_masked ? '<span class="badge p4" style="font-size:10px;">BLOCKED</span>'
      : r.ml_score !== undefined && r.ml_score !== null
        ? `<span class="badge" style="background:#6366f1;font-size:10px;">ML ${r.ml_score}</span>`
        : '';
    return `
      <tr data-grid="${r.grid_id}" class="${r.ml_masked ? 'row-masked' : ''}">
        <td style="color:var(--text-muted);font-weight:500;">${String(i + 1).padStart(2, '0')}</td>
        <td><b style="font-weight:600;">${r.grid_id}</b> ${mlBadge}</td>
        <td><span class="badge ${pKey}">${r.priority_class.replace('Prioritas ', 'P')}</span></td>
        <td>
          <span class="score-bar"><span class="score-bar-fill" style="width:${barW}%;background:${barColor};"></span></span>
          <b style="font-weight:600;">${r.final_priority_score}</b>
        </td>
        <td style="color:var(--text-secondary)">${r.Ni_avg}%</td>
        <td style="color:var(--text-secondary)">${r.mag_score}</td>
        <td style="color:var(--text-secondary)">${r.slope_deg}°</td>
        <td><span class="badge ${r.kill_zone_exclusion ? 'p4' : r.is_grandfathered ? 'p3' : r.permit_required === 'IUP (AMDAL/UKL-UPL)' ? 'p1' : 'p2'} compliance-badge" title="${r.compliance_status || ''}">${r.kill_zone_exclusion ? '⛔ TERLARANG' : r.is_grandfathered ? '⚠️ KETERLANJURAN' : r.legal_zone === 'Areal Penggunaan Lain' ? 'APL' : r.legal_zone === 'Hutan Produksi' ? 'HP' : r.legal_status || '-'}</span></td>
        <td style="color:var(--text-secondary);font-size:12px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.reason}</td>
      </tr>
    `;
  }).join('');
  els.rankingBody.querySelectorAll('tr[data-grid]').forEach(tr => {
    tr.addEventListener('click', () => {
      els.rankingBody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      selectTarget(tr.dataset.grid);
    });
  });
}

const pColors = { p1: '#10b981', p2: '#f59e0b', p3: '#f97316', p4: '#ef4444' };

function selectTarget(gridId) {
  if (!gridId) return;
  const row = resultRows.find(r => r.grid_id === gridId);
  if (!row) return;
  selectedGridId = gridId;
  els.targetDetailTitle.textContent = gridId;
  const pKey = priorityKey(row.priority_class);
  const pColor = pColors[pKey] || '#10b981';
  els.targetDetail.innerHTML = `
    <span class="badge ${pKey}">${row.priority_class}</span>
    <div style="margin: 16px 0; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.05); overflow: hidden;">
      <div style="height: 100%; width: ${row.final_priority_score}%; background: ${pColor}; border-radius: 2px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
    </div>
    <div class="detail-line"><span>Final score:</span><b>${row.final_priority_score}/100</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:8px 0;margin:4px 0;"><span>Recommended Spacing:</span><b>${row.drill_spacing || '-'}m &times; ${row.drill_spacing || '-'}m</b></div>
    <div class="detail-line"><span>Required Drill Holes:</span><b>${row.estimated_drill_holes ?? '-'}</b></div>
    <div class="detail-line"><span>Est. Drilling Cost:</span><b>${formatRupiah(row.estimated_cost_rp)}</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>Ni average:</span><b>${row.Ni_avg}%</b></div>
    <div class="detail-line"><span>Processing Route:</span><b style="color:#0ea5e9;">${row.processing_route || '-'}</b></div>
    <div class="detail-line" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px;margin-bottom:6px;"><span>Ore Character:</span><b>${row.processing_desc || '-'}</b></div>
    <div class="detail-line"><span>K3 Safety Risk:</span><b style="color:${row.safety_level && row.safety_level.includes('High') ? '#ef4444' : row.safety_level && row.safety_level.includes('Moderate') ? '#f59e0b' : '#10b981'};">${row.safety_level || '-'}</b></div>
    <div class="detail-line" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px;margin-bottom:6px;"><span>Safety Warning:</span><b>${row.safety_warning || '-'}</b></div>
    <div class="detail-line"><span>Magnetic score:</span><b>${row.mag_score}</b></div>
    <div class="detail-line"><span>Slope:</span><b>${row.slope_deg}°</b></div>
    <div class="detail-line"><span>Jarak ke jalan:</span><b>${row.distance_to_road_m} m</b></div>
    <div class="detail-line"><span>Jarak ke sungai:</span><b>${row.distance_to_river_m} m</b></div>
    <div class="detail-line"><span>Status legal:</span><b>${row.legal_status}</b></div>
    <div class="detail-line"><span>Zona legal:</span><b>${row.legal_zone || '-'}</b></div>
    <div class="detail-line"><span>Izin dibutuhkan:</span><b>${row.permit_required || '-'}</b></div>
    <div class="detail-line"><span>Referensi hukum:</span><b>${row.legal_reference || '-'}</b></div>
    <div class="detail-line"><span>Kepatuhan (Compliance):</span><b style="${row.kill_zone_exclusion ? 'color:#ef4444;' : row.is_grandfathered ? 'color:#f59e0b;' : 'color:#10b981;'}">${row.compliance_status || '-'}</b></div>
    <div class="detail-line"><span>Mitigasi Tambahan:</span><b>${row.mitigation_requirements || '-'}</b></div>
    <div class="detail-line"><span>Keterlanjuran:</span><b style="color:${row.is_grandfathered ? '#f59e0b' : 'var(--text-muted)'};">${row.is_grandfathered ? '⚠️ Ya' : 'Tidak'}</b></div>
    <div class="detail-line"><span>Kill zone:</span><b style="color:${row.kill_zone_exclusion ? '#ef4444' : 'var(--text-muted)'};">${row.kill_zone_exclusion ? '⛔ TERLARANG' : 'Tidak'}</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>Skor Viabilitas:</span><b style="${row.viability_score === 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${row.viability_score}</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>Skor ML:</span><b style="${row.ml_masked ? 'color:#ef4444;' : 'color:#6366f1;'}">${row.ml_masked ? 'DIBLOKIR — ' + (row.ml_block_reason || '') : row.ml_score != null ? row.ml_score + '/10' : 'N/A'}</b></div>
    ${row.ml_confidence != null ? '<div class="detail-line"><span>Kepercayaan ML:</span><b>' + (row.ml_confidence * 100).toFixed(0) + '%</b></div>' : ''}
    ${row.ml_cv_score != null ? '<div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>Akurasi Model R²:</span><b>' + row.ml_cv_score.toFixed(3) + '</b></div>' : ''}
    <div class="detail-line"><span>ML Primary:</span><b style="color:${row.ml_primary ? '#10b981' : 'var(--text-muted)'};">${row.ml_primary ? 'Ya' : 'Tidak'}</b></div>
    ${row.ml_top_features?.length ? '<div class="detail-line" style="flex-direction:column;align-items:flex-start;"><span>ML Top Features:</span><b style="font-size:11px;line-height:1.5;">' + row.ml_top_features.map(f => f.feature + ': ' + (f.importance * 100).toFixed(1) + '%').join('<br>') + '</b></div>' : ''}
    <div class="reason-box"><b>Alasan rekomendasi</b>${row.reason}</div>
    ${(row.qaqc_flags && row.qaqc_flags.length > 0) ? '<div class="reason-box" style="border-left-color:#f59e0b; background:rgba(245,158,11,0.1); margin-top:8px;"><b>⚠️ QA/QC Interventions</b>' + row.qaqc_flags.join('<br>') + '</div>' : '<div class="reason-box" style="border-left-color:#10b981; background:rgba(16,185,129,0.1); margin-top:8px;"><b>✓ QA/QC Passed</b>Data parameters within normal geological bounds.</div>'}
    <div style="margin-top: 15px;">
        <button id="btn-generate-esg" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background:linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); transition: all 0.2s;">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            Auto-Generate ESG & Permit Draft
        </button>
    </div>
    <div id="esg-draft-container" style="display: none; margin-top: 12px; padding: 16px; background: rgba(15,23,42,0.8); border: 1px solid rgba(139,92,246,0.3); border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.6; color: #e2e8f0; max-height: 350px; overflow-y: auto;"></div>
  `;
  Object.entries(gridLayers).forEach(([gid, layer]) => {
    const feat = rawGrid.features.find(f => f.properties.grid_id === gid);
    layer.setStyle(gridStyle(feat || { properties: {} }));
  });
  const hl = gridLayers[gridId];
  if (hl) hl.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.85 });

  const btnEsg = document.getElementById('btn-generate-esg');
  if (btnEsg) {
    btnEsg.addEventListener('click', async () => {
      const container = document.getElementById('esg-draft-container');
      btnEsg.disabled = true;
      btnEsg.style.opacity = '0.5';
      btnEsg.innerHTML = 'Generating via NiTERRA AI...';
      container.style.display = 'block';
      container.innerHTML = '<span style="color:#8b5cf6;">[SYSTEM] Initializing GenAI Drafting Agent...</span><br><br>';
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/generate-esg-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid_id: gridId,
            slope_deg: row.slope_deg || 0,
            distance_to_river_m: row.distance_to_river_m || 500,
            legal_status: row.legal_status || 'Aman',
            lithology: row.lithology || 'Ultramafik',
            ni_avg: row.Ni_avg || 0,
            roi_savings_miliar: Number(window.roiSavingsMiliar) || 0
          })
        });
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        let i = 0;
        const text = data.draft;
        container.innerHTML = '';
        function typeWriter() {
          if (i < text.length) {
            let char = text.charAt(i);
            if (char === '\\n') {
                container.innerHTML += '<br>';
            } else {
                container.innerHTML += char;
            }
            i++;
            container.scrollTop = container.scrollHeight;
            setTimeout(typeWriter, 5);
          } else {
            btnEsg.innerHTML = 'Draft Complete - Downloading PDF...';
            const opt = {
              margin: 15,
              filename: `ESG_Permit_Draft_${gridId}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            if (typeof html2pdf !== 'undefined') {
              const htmlContent = `
                <div style="padding: 20px; background: #ffffff; color: #000000; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6;">
                  ${container.innerHTML}
                </div>
              `;
              html2pdf().set(opt).from(htmlContent).save().then(() => {
                btnEsg.innerHTML = 'Draft Complete';
              });
            } else {
              btnEsg.innerHTML = 'Draft Complete';
            }
          }
        }
        typeWriter();
      } catch (err) {
        btnEsg.innerHTML = 'Draft Ready (Offline Mode)';
        const text = generateEsgDraftClient(row);
        container.innerHTML = '';
        let i = 0;
        function typeWriter() {
          if (i < text.length) {
            let char = text.charAt(i);
            if (char === '\n') {
                container.innerHTML += '<br>';
            } else {
                container.innerHTML += char;
            }
            i++;
            container.scrollTop = container.scrollHeight;
            setTimeout(typeWriter, 5);
          } else {
            btnEsg.innerHTML = 'Draft Complete (Offline)';
          }
        }
        typeWriter();
      }
    });
  }
}

let lastFeatureBars = null;

function drawFeatureBars(mlImportances) {
  if (mlImportances) {
    lastFeatureBars = mlImportances;
    const total = mlImportances.reduce((s, f) => s + f.importance, 0) || 1;
    els.featureBars.innerHTML = mlImportances.slice(0, 9).map((f, i) => `
      <div class="bar-row" style="animation: fadeInUp 0.4s cubic-bezier(0, 0, 0.2, 1) ${i * 0.06}s both;">
        <span>${f.feature}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${(f.importance / total) * 100}%; background:#6366f1;"></div></div>
        <b>${(f.importance * 100).toFixed(1)}%</b>
      </div>
    `).join('');
    return;
  }
  const labels = [
    ['Magnetometer anomaly', weights.magnetic],
    ['Geochemistry', weights.geochemistry],
    ['Lithology', weights.lithology],
    ['Slope/topography', weights.slope],
    ['Road access', weights.road],
    ['River/ESG risk', weights.river],
    ['Legal status', weights.legal],
    ['Smelter distance', weights.smelter],
    ['Area size', weights.area]
  ];
  els.featureBars.innerHTML = labels.map(([name, w], i) => `
    <div class="bar-row" style="animation: fadeInUp 0.4s cubic-bezier(0, 0, 0.2, 1) ${i * 0.06}s both;">
      <span>${name}</span>
      <div class="bar-bg"><div class="bar-fill" style="width:${w * 100}%;"></div></div>
      <b>${Math.round(w * 100)}%</b>
    </div>
  `).join('');
}

function downloadResults() {
  if (!resultRows.length) {
    setStatus('Belum ada hasil', 'Jalankan analisis dulu sebelum download CSV.');
    return;
  }
  const headers = ['rank','grid_id','priority_class','final_priority_score','Ni_avg','Fe_avg','Co_avg','mag_score','risk_score','slope_deg','distance_to_river_m','distance_to_road_m','legal_status','legal_zone','permit_required','legal_reference','mitigation_requirements','compliance_status','is_grandfathered','kill_zone_exclusion','viability_score','ml_score','ml_primary','ml_confidence','ml_cv_score','ml_masked','ml_block_reason','distance_to_smelter_km','area_ha','reason'];
  const lines = [headers.join(',')];
  resultRows.forEach((r, i) => {
    lines.push(headers.map(h => {
      const v = h === 'rank' ? i + 1 : (r[h] ?? '');
      return `"${String(v).replaceAll('"', '""')}"`;
    }).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'niterra_priority_results.csv';
  a.click();
  URL.revokeObjectURL(url);
}


