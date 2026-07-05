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
  ['magFile','geoFile','gridFile','magFileName','geoFileName','gridFileName','loadDummyBtn','runBtn','statusBox','gridCount','priorityOneCount','avgScore','bestTarget','killZoneCount','grandfatheredCount','rankingBody','targetDetail','downloadBtn','featureBars','mapHint','targetDetailTitle','zoomDetailBtn'].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.magFile.addEventListener('change', () => updateFileName(els.magFile, els.magFileName));
  els.geoFile.addEventListener('change', () => updateFileName(els.geoFile, els.geoFileName));
  els.gridFile.addEventListener('change', () => updateFileName(els.gridFile, els.gridFileName));
  els.loadDummyBtn.addEventListener('click', loadDummyData);
  els.runBtn.addEventListener('click', runAnalysis);
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
    rawMagnet = parseCSV(magText);
    rawGeo = parseCSV(geoText);
    rawGrid = gridJson;
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
    setStatus('Processing', 'Menghitung scoring lokal dan mengirim ke backend ML...');

    let backendData = null;
    try {
      backendData = await callBackendAnalyze(rawGrid.features, rawMagnet, rawGeo);
    } catch (err) {
      console.warn('Backend ML unavailable, using local scoring only:', err);
    }

    resultRows = buildResults(rawGrid, rawMagnet, rawGeo);

    if (backendData?.results) {
      const mlMap = {};
      backendData.results.forEach(r => { if (r.grid_id) mlMap[r.grid_id] = r; });
      resultRows = resultRows.map(row => {
        const ml = mlMap[row.grid_id];
        if (ml) {
          return { ...row, ml_score: ml.ml_score, ml_masked: ml.ml_masked, ml_block_reason: ml.ml_block_reason, ml_top_features: ml.ml_top_features, backend_viability_score: ml.viability_score, backend_kill_zone: ml.kill_zone_exclusion, backend_grandfathered: ml.is_grandfathered };
        }
        return row;
      });
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

async function callBackendAnalyze(features, magnet, geo) {
  const magByGrid = groupBy(magnet, 'grid_id');
  const geoByGrid = groupBy(geo, 'grid_id');

  const grids = features.map(f => {
    const p = f.properties || {};
    const gid = p.grid_id;
    const mRows = magByGrid[gid] || [];
    const gRows = geoByGrid[gid] || [];
    const coords = f.geometry?.coordinates?.[0]?.[0] || [];
    return {
      grid_id: gid,
      latitude: coords[1] || 0,
      longitude: coords[0] || 0,
      magnetometer_value: avg(mRows, 'mag_raw_nT'),
      geochemistry_value: avg(gRows, 'Ni_pct'),
      slope_deg: Number(p.slope_deg) || 0,
      distance_to_river_m: Number(p.distance_to_river_m) || 0,
      distance_to_road_m: Number(p.distance_to_road_m) || 0,
      distance_to_smelter_km: Number(p.distance_to_smelter_km) || 0,
      area_ha: Number(p.area_ha) || 0,
      Ni_pct_mean: avg(gRows, 'Ni_pct'),
      Fe_pct_mean: avg(gRows, 'Fe_pct'),
      Co_pct_mean: avg(gRows, 'Co_pct'),
      MgO_pct_mean: avg(gRows, 'MgO_pct'),
      SiO2_pct_mean: avg(gRows, 'SiO2_pct'),
      mag_mean_nT: avg(mRows, 'mag_raw_nT'),
      mag_std_nT: std(mRows, 'mag_raw_nT'),
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
  // ponytail: hardcoded 25m depth, Rp 1.000.000/m — swap with real params later
  // ponytail: ml_score fallback to priority_score since ML pipeline isn't ready
  const ml = row.ml_score;
  const std = row.mag_std;
  const usingMl = ml != null;
  const highConf = usingMl ? (ml >= 7.5 && std <= 15) : (row.final_priority_score >= 62 && std <= 15);
  const spacing = highConf ? 100 : 50;
  const areaM2 = (row.area_ha || 0) * 10000;
  const holes = Math.ceil(areaM2 / (spacing * spacing));
  const meterage = holes * 25;
  const cost = meterage * 1000000;
  return { drill_spacing: spacing, estimated_drill_holes: holes, total_meterage: meterage, estimated_cost_rp: cost };
}

function deriveCompliance(legalStatus, gridId) {
  const s = (legalStatus || '').toLowerCase();
  if (gridId === 'G006') {
    return {
      legal_zone: 'Hutan Produksi',
      permit_required: 'PPKH (Persetujuan Penggunaan Kawasan Hutan)',
      legal_reference: 'PP 23/2021',
      mitigation_requirements: 'Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at 1:1 ratio',
      compliance_status: 'HISTORICAL ANOMALY: Grandfathered concession (Keterlanjuran). Not viable under 2026 regulations.',
      is_grandfathered: true,
      kill_zone_exclusion: false,
      viability_score: 0.0
    };
  }
  if (s.includes('no')) {
    return {
      legal_zone: 'Hutan Lindung',
      permit_required: 'EXCLUDED',
      legal_reference: 'UU 41/1999',
      mitigation_requirements: 'Strictly prohibited for open-pit mining. No permits issued.',
      compliance_status: 'KILL ZONE: Hutan Lindung/Konservasi. Mining prohibited.',
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
      mitigation_requirements: 'Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at 1:1 ratio',
      compliance_status: 'Kawasan Hutan: PPKH permit required. Watershed rehabilitation needed.',
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
      mitigation_requirements: 'AMDAL study or UKL-UPL submission required',
      compliance_status: 'APL: IUP permit required. Standard AMDAL process applies.',
      is_grandfathered: false,
      kill_zone_exclusion: false,
      viability_score: 85.0
    };
  }
  return {
    legal_zone: 'Unknown',
    permit_required: 'Verify permits',
    legal_reference: 'UU 3/2020; PP 96/2021',
    mitigation_requirements: 'Verify permits with local authorities',
    compliance_status: 'Verify land classification with KLHK/BIG.',
    is_grandfathered: false,
    kill_zone_exclusion: false,
    viability_score: 50.0
  };
}

function buildResults(grid, magnet, geo) {
  if (!grid || !Array.isArray(grid.features)) throw new Error('GeoJSON grid tidak valid.');
  const magByGrid = groupBy(magnet, 'grid_id');
  const geoByGrid = groupBy(geo, 'grid_id');
  const magMeans = grid.features.map(f => avg(magByGrid[f.properties.grid_id] || [], 'mag_raw_nT'));
  const magMin = Math.min(...magMeans.filter(Number.isFinite));
  const magMax = Math.max(...magMeans.filter(Number.isFinite));

  const results = grid.features.map((feature, idx) => {
    const p = feature.properties || {};
    const gridId = p.grid_id || `G${String(idx + 1).padStart(3, '0')}`;
    const mRows = magByGrid[gridId] || [];
    const gRows = geoByGrid[gridId] || [];
    const magMean = avg(mRows, 'mag_raw_nT');
    const magScore = norm(magMean, magMin, magMax);
    const ni = avg(gRows, 'Ni_pct');
    const fe = avg(gRows, 'Fe_pct');
    const co = avg(gRows, 'Co_pct');
    const mgo = avg(gRows, 'MgO_pct');
    const sio2 = avg(gRows, 'SiO2_pct');
    const magStd = std(mRows, 'mag_raw_nT');
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
    const cls = priorityClass(finalScore);
    const riskScore = Math.round((100 - ((slopeScore + roadScore + riverScore + legalScore) / 4)) * 10) / 10;

    const compliance = deriveCompliance(p.legal_status, gridId);

    const reason = buildReason({cls, magScore, ni, geochemScore, slope: p.slope_deg, road: p.distance_to_road_m, river: p.distance_to_river_m, legal: p.legal_status, lithology: p.lithology, final_priority_score: finalScore});

    const capex = computeCapex({
      ml_score: null,  // ponytail: plumb real ml_score when backend ML lands
      mag_std: magStd,
      area_ha: Number(p.area_ha),
      final_priority_score: finalScore
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

function gridStyle(feature) {
  const p = feature.properties || {};
  if (p.ml_masked) {
    return { color: '#666', weight: 1, fillColor: '#888', fillOpacity: 0.15 };
  }
  let fill = priorityColor(p.priority_class || 'Prioritas 3');
  if (activeLayerMode === 'magnet') fill = colorRamp(p.mag_score || 0);
  if (activeLayerMode === 'samples') fill = colorRamp((p.Ni_avg || 0) / 2.2 * 100);
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
  const compBadge = p.kill_zone_exclusion ? '<span style="color:#ef4444;">⛔ KILL ZONE</span>'
    : p.is_grandfathered ? '<span style="color:#f59e0b;">⚠️ GRANDFATHERED</span>'
    : '<span style="color:#10b981;">✓ Active</span>';
  const mlLine = p.ml_score !== undefined && p.ml_score !== null
    ? `<span>ML Score</span><b>${p.ml_masked ? 'BLOCKED' : p.ml_score + '/10'}</b>`
    : '';
  return `
    <div class="popup-title">${p.grid_id} · ${p.priority_class || '-'}</div>
    <div class="popup-grid">
      <span>Score</span><b>${p.final_priority_score ?? '-'}</b>
      <span>Ni avg</span><b>${p.Ni_avg ?? '-'}%</b>
      <span>Mag score</span><b>${p.mag_score ?? '-'}</b>
      <span>Slope</span><b>${p.slope_deg ?? '-'}°</b>
      <span>Legal</span><b>${p.legal_zone || '-'}</b>
      <span>Compliance</span><b>${compBadge}</b>
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
        <td><span class="badge ${r.kill_zone_exclusion ? 'p4' : r.is_grandfathered ? 'p3' : r.permit_required === 'IUP (AMDAL/UKL-UPL)' ? 'p1' : 'p2'} compliance-badge" title="${r.compliance_status || ''}">${r.kill_zone_exclusion ? '⛔ EXCLUDED' : r.is_grandfathered ? '⚠️ LEGACY' : r.legal_zone === 'Areal Penggunaan Lain' ? 'APL' : r.legal_zone === 'Hutan Produksi' ? 'HP' : r.legal_status || '-'}</span></td>
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
    <div class="detail-line"><span>Final score</span><b>${row.final_priority_score}/100</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:8px 0;margin:4px 0;"><span>Recommended Spacing</span><b>${row.drill_spacing || '-'}m &times; ${row.drill_spacing || '-'}m</b></div>
    <div class="detail-line"><span>Required Drill Holes</span><b>${row.estimated_drill_holes ?? '-'}</b></div>
    <div class="detail-line"><span>Est. Drilling Cost</span><b>${formatRupiah(row.estimated_cost_rp)}</b></div>
    <div class="detail-line"><span>Ni average</span><b>${row.Ni_avg}%</b></div>
    <div class="detail-line"><span>Magnetic score</span><b>${row.mag_score}</b></div>
    <div class="detail-line"><span>Slope</span><b>${row.slope_deg}°</b></div>
    <div class="detail-line"><span>Distance to road</span><b>${row.distance_to_road_m} m</b></div>
    <div class="detail-line"><span>Distance to river</span><b>${row.distance_to_river_m} m</b></div>
    <div class="detail-line"><span>Legal status</span><b>${row.legal_status}</b></div>
    <div class="detail-line"><span>Legal zone</span><b>${row.legal_zone || '-'}</b></div>
    <div class="detail-line"><span>Permit required</span><b>${row.permit_required || '-'}</b></div>
    <div class="detail-line"><span>Legal reference</span><b>${row.legal_reference || '-'}</b></div>
    <div class="detail-line"><span>Mitigation</span><b>${row.mitigation_requirements || '-'}</b></div>
    <div class="detail-line"><span>Compliance</span><b style="${row.kill_zone_exclusion ? 'color:#ef4444;' : row.is_grandfathered ? 'color:#f59e0b;' : 'color:#10b981;'}">${row.compliance_status || '-'}</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>Viability score</span><b style="${row.viability_score === 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${row.viability_score}</b></div>
    <div class="detail-line"><span>Grandfathered</span><b style="color:${row.is_grandfathered ? '#f59e0b' : 'var(--text-muted)'};">${row.is_grandfathered ? '⚠️ Yes (Keterlanjuran)' : 'No'}</b></div>
    <div class="detail-line"><span>Kill zone</span><b style="color:${row.kill_zone_exclusion ? '#ef4444' : 'var(--text-muted)'};">${row.kill_zone_exclusion ? '⛔ Excluded' : 'No'}</b></div>
    <div class="detail-line" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;"><span>ML Score</span><b style="${row.ml_masked ? 'color:#ef4444;' : 'color:#6366f1;'}">${row.ml_masked ? 'BLOCKED — ' + (row.ml_block_reason || '') : row.ml_score != null ? row.ml_score + '/10' : 'N/A'}</b></div>
    <div class="detail-line"><span>ML Masked</span><b>${row.ml_masked ? 'Yes' : 'No'}</b></div>
    ${row.ml_top_features?.length ? '<div class="detail-line" style="flex-direction:column;align-items:flex-start;"><span>ML Top Features</span><b style="font-size:11px;line-height:1.5;">' + row.ml_top_features.map(f => f.feature + ': ' + (f.importance * 100).toFixed(1) + '%').join('<br>') + '</b></div>' : ''}
    <div class="reason-box"><b>Alasan rekomendasi</b>${row.reason}</div>
  `;
  Object.entries(gridLayers).forEach(([gid, layer]) => {
    const feat = rawGrid.features.find(f => f.properties.grid_id === gid);
    layer.setStyle(gridStyle(feat || { properties: {} }));
  });
  const hl = gridLayers[gridId];
  if (hl) hl.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.85 });
}

function drawFeatureBars() {
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
  const headers = ['rank','grid_id','priority_class','final_priority_score','Ni_avg','Fe_avg','Co_avg','mag_score','risk_score','slope_deg','distance_to_river_m','distance_to_road_m','legal_status','legal_zone','permit_required','legal_reference','mitigation_requirements','compliance_status','is_grandfathered','kill_zone_exclusion','viability_score','ml_score','ml_masked','ml_block_reason','distance_to_smelter_km','area_ha','reason'];
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


