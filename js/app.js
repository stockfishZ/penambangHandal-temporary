let map;
let gridLayer;
let magnetLayer;
let sampleLayer;
let resultRows = [];
let rawMagnet = [];
let rawGeo = [];
let rawGrid = null;
let activeLayerMode = 'priority';

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
  setTimeout(forceMapResize, 250);
  setTimeout(forceMapResize, 900);
});

function bindElements() {
  ['magFile','geoFile','gridFile','magFileName','geoFileName','gridFileName','loadDummyBtn','runBtn','statusBox','gridCount','priorityOneCount','avgScore','bestTarget','rankingBody','targetDetail','downloadBtn','featureBars','mapHint'].forEach(id => {
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
    setStatus('Processing', 'Menghitung magnetic score, geochemistry score, GIS-risk score, dan priority class...');
    resultRows = buildResults(rawGrid, rawMagnet, rawGeo);
    renderMapLayers();
    renderSummary();
    renderRanking();
    selectTarget(resultRows[0]?.grid_id);
    setStatus('Done', `${resultRows.length} grid berhasil dianalisis. Grid prioritas tampil di peta kanan dan tabel output.`);
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

function norm(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
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
  const colors = { p1: '#8ee65f', p2: '#f3cf4b', p3: '#e9a534', p4: '#e84d3c' };
  return colors[key];
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
    const mgo = avg(gRows, 'MgO_pct');
    const sio2 = avg(gRows, 'SiO2_pct');
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

    const reason = buildReason({cls, magScore, ni, geochemScore, slope: p.slope_deg, road: p.distance_to_road_m, river: p.distance_to_river_m, legal: p.legal_status, lithology: p.lithology});

    feature.properties = {
      ...p,
      grid_id: gridId,
      mag_mean: Math.round(magMean * 10) / 10,
      mag_score: Math.round(magScore * 10) / 10,
      Ni_avg: Math.round(ni * 100) / 100,
      Fe_avg: Math.round(fe * 100) / 100,
      MgO_avg: Math.round(mgo * 100) / 100,
      SiO2_avg: Math.round(sio2 * 100) / 100,
      geochem_score: Math.round(geochemScore * 10) / 10,
      lithology_score: lithScore,
      final_priority_score: finalScore,
      risk_score: riskScore,
      priority_class: cls,
      reason
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
  if (!parts.length) parts.push('perlu validasi lanjutan karena parameter utama belum dominan');
  return parts.join(', ') + '.';
}

function renderMapLayers() {
  if (!map) return;
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
    }
  });

  magnetLayer = L.layerGroup(rawMagnet.map(r => {
    const lat = Number(r.latitude); const lon = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return L.circleMarker([lat, lon], {
      radius: activeLayerMode === 'magnet' ? 7 : 4,
      color: '#07140f',
      weight: 1,
      fillColor: '#53c7ff',
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
      fillColor: '#f6d04c',
      fillOpacity: activeLayerMode === 'samples' ? 0.95 : 0.58
    }).bindPopup(`<b>${r.sample_id}</b><br>Grid: ${r.grid_id}<br>Ni: ${r.Ni_pct}%<br>Fe: ${r.Fe_pct}%`);
  }).filter(Boolean));

  gridLayer.addTo(map);
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
  if (val >= 75) return '#8ee65f';
  if (val >= 55) return '#f3cf4b';
  if (val >= 35) return '#e9a534';
  return '#e84d3c';
}

function popupContent(p) {
  return `
    <div class="popup-title">${p.grid_id} · ${p.priority_class || '-'}</div>
    <div class="popup-grid">
      <span>Score</span><b>${p.final_priority_score ?? '-'}</b>
      <span>Ni avg</span><b>${p.Ni_avg ?? '-'}%</b>
      <span>Mag score</span><b>${p.mag_score ?? '-'}</b>
      <span>Slope</span><b>${p.slope_deg ?? '-'}°</b>
      <span>Legal</span><b>${p.legal_status ?? '-'}</b>
    </div>`;
}

function renderSummary() {
  const n = resultRows.length;
  els.gridCount.textContent = n || '-';
  els.priorityOneCount.textContent = resultRows.filter(r => r.priority_class === 'Prioritas 1').length || '0';
  els.avgScore.textContent = n ? Math.round(resultRows.reduce((a,b) => a + b.final_priority_score, 0) / n) : '-';
  els.bestTarget.textContent = resultRows[0]?.grid_id || '-';
}

function renderRanking() {
  if (!resultRows.length) return;
  els.rankingBody.innerHTML = resultRows.map((r, i) => `
    <tr data-grid="${r.grid_id}">
      <td>${i + 1}</td>
      <td><b>${r.grid_id}</b></td>
      <td><span class="badge ${priorityKey(r.priority_class)}">${r.priority_class}</span></td>
      <td><b>${r.final_priority_score}</b></td>
      <td>${r.Ni_avg}%</td>
      <td>${r.risk_score}</td>
      <td>${r.reason}</td>
    </tr>
  `).join('');
  els.rankingBody.querySelectorAll('tr[data-grid]').forEach(tr => {
    tr.addEventListener('click', () => selectTarget(tr.dataset.grid));
  });
}

function selectTarget(gridId) {
  if (!gridId) return;
  const row = resultRows.find(r => r.grid_id === gridId);
  if (!row) return;
  els.targetDetail.innerHTML = `
    <span class="badge ${priorityKey(row.priority_class)}">${row.priority_class}</span>
    <div class="detail-line"><span>Grid ID</span><b>${row.grid_id}</b></div>
    <div class="detail-line"><span>Final score</span><b>${row.final_priority_score}/100</b></div>
    <div class="detail-line"><span>Ni average</span><b>${row.Ni_avg}%</b></div>
    <div class="detail-line"><span>Magnetic score</span><b>${row.mag_score}</b></div>
    <div class="detail-line"><span>Slope</span><b>${row.slope_deg}°</b></div>
    <div class="detail-line"><span>Distance to road</span><b>${row.distance_to_road_m} m</b></div>
    <div class="detail-line"><span>Distance to river</span><b>${row.distance_to_river_m} m</b></div>
    <div class="detail-line"><span>Legal status</span><b>${row.legal_status}</b></div>
    <div class="reason-box"><b>Alasan rekomendasi:</b><br>${row.reason}</div>
  `;
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
  els.featureBars.innerHTML = labels.map(([name, w]) => `
    <div class="bar-row">
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
  const headers = ['rank','grid_id','priority_class','final_priority_score','Ni_avg','Fe_avg','mag_score','risk_score','slope_deg','distance_to_river_m','distance_to_road_m','legal_status','distance_to_smelter_km','area_ha','reason'];
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
