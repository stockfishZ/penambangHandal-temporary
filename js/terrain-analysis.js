// ponytail: ultra — single-page exploration with real backend ML inference
document.addEventListener('DOMContentLoaded', () => {
  const NICKEL_BELTS_URL = 'data/indonesia_nickel_belts.geojson';
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : 'http://localhost:8000';
  const $ = id => document.getElementById(id);
  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const sites = window.NICKEL_SITES.features;

  const INDONESIA_SMELTERS = [
    {
      id: 'pomalaa',
      name: 'Smelter Feronikel Pomalaa (Kolaka)',
      shortName: 'PT ANTAM Pomalaa',
      company: 'PT ANTAM Tbk (MIND ID)',
      isAntam: true,
      location: 'Kolaka, Sulawesi Tenggara',
      lat: -4.180,
      lon: 121.600,
      type: 'Pabrik Feronikel (FeNi)',
      capacity: '27.000 ton Ni/tahun'
    },
    {
      id: 'halmahera_timur',
      name: 'Pabrik Feronikel Haltim (P3FH)',
      shortName: 'PT ANTAM Haltim',
      company: 'PT ANTAM Tbk (MIND ID)',
      isAntam: true,
      location: 'Halmahera Timur, Maluku Utara',
      lat: 0.880,
      lon: 128.320,
      type: 'Pabrik Feronikel (FeNi)',
      capacity: '13.500 ton Ni/tahun'
    },
    {
      id: 'sorowako',
      name: 'Smelter Sorowako',
      shortName: 'PT Vale Sorowako',
      company: 'PT Vale Indonesia Tbk (MIND ID Ecosystem)',
      isAntam: false,
      location: 'Luwu Timur, Sulawesi Selatan',
      lat: -2.533,
      lon: 121.350,
      type: 'Nickel Matte & FeNi',
      capacity: '75.000 ton Ni/tahun'
    },
    {
      id: 'imip',
      name: 'Kawasan Industri IMIP (Morowali)',
      shortName: 'IMIP Morowali',
      company: 'PT Indonesia Morowali Industrial Park',
      isAntam: false,
      location: 'Morowali, Sulawesi Tengah',
      lat: -2.825,
      lon: 122.158,
      type: 'RKEF (NPI) & HPAL (MHP)',
      capacity: '3.000.000 ton/tahun'
    },
    {
      id: 'konawe',
      name: 'Kawasan Industri Konawe (VDNI/OSS)',
      shortName: 'VDNI Konawe',
      company: 'PT Virtue Dragon Nickel Industry',
      isAntam: false,
      location: 'Konawe, Sulawesi Tenggara',
      lat: -3.880,
      lon: 122.430,
      type: 'RKEF (NPI) & Stainless Steel',
      capacity: '1.800.000 ton/tahun'
    },
    {
      id: 'wedabay',
      name: 'Kawasan Industri IWIP (Weda Bay)',
      shortName: 'IWIP Weda Bay',
      company: 'PT Indonesia Weda Bay Industrial Park',
      isAntam: false,
      location: 'Halmahera Tengah, Maluku Utara',
      lat: 0.485,
      lon: 127.915,
      type: 'RKEF & HPAL (MHP)',
      capacity: '2.400.000 ton/tahun'
    },
    {
      id: 'obi',
      name: 'Kawasan Industri Pulau Obi (Harita)',
      shortName: 'Harita Pulau Obi',
      company: 'PT Trimegah Bangun Persada (Harita)',
      isAntam: false,
      location: 'Halmahera Selatan, Maluku Utara',
      lat: -1.545,
      lon: 127.575,
      type: 'HPAL & RKEF',
      capacity: '1.200.000 ton/tahun'
    },
    {
      id: 'bantaeng',
      name: 'Smelter Bantaeng',
      shortName: 'Huadi Bantaeng',
      company: 'PT Huadi Nickel-Alloy Indonesia',
      isAntam: false,
      location: 'Bantaeng, Sulawesi Selatan',
      lat: -5.550,
      lon: 120.020,
      type: 'RKEF (FeNi)',
      capacity: '250.000 ton/tahun'
    }
  ];

  let map, drawnItems, drawControl, activeDrawHandler;
  let currentBbox = null, currentGrid = null, currentParams = null;
  let gridLayer = null, gridMlLayer = null;
  let beltLayer = null, beltPolygons = null, forestryLayer = null, forestryData = null;
  let smelterMarkers = [], smelterLineLayer = null, currentNearestSmelter = null;
  let _3dRendered = false, _3dRenderedWithMl = false, _elevationLoading = false, _drawingActive = false, _3dMesh = null;
  let mlResults = null, mlLoading = false, mlError = null;

  const tierColor = t => t === 'HIGH' ? '#9FD8BD' : t === 'MEDIUM' ? '#E2A356' : '#ef4444';
  const tierLabel = t => t === 'HIGH' ? 'High' : t === 'MEDIUM' ? 'Medium' : 'Low';
  const scoreColor = s => s >= 75 ? 'green' : s >= 50 ? 'yellow' : 'red';

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function initMap() {
    map = L.map('exploreMap').setView([-2.0, 121.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(map);

    loadNickelBelts();
    loadForestryBoundaries();
    loadSmelterMarkers();
    setupDrawControl();
  }

  function loadNickelBelts() {
    fetch(NICKEL_BELTS_URL)
      .then(r => r.json())
      .then(data => {
        beltPolygons = data;
        L.geoJSON(data, {
          style: { color: '#000000', fillOpacity: 0, weight: 6 }
        }).addTo(map);
        beltLayer = L.geoJSON(data, {
          style: f => ({
            color: tierColor(f.properties.tier),
            fillOpacity: 0,
            weight: 3,
            dashArray: '10 6'
          })
        }).addTo(map);
        beltLayer.bindTooltip(f => `<b>${f.properties.name}</b><br>${tierLabel(f.properties.tier)}`, {sticky:true});
      });
  }

  function loadForestryBoundaries() {
    fetch('data/forestry_boundaries.geojson')
      .then(r => r.json())
      .then(data => {
        forestryData = data;
        const legalColor = { 'no-go': '#ef4444', 'conditional': '#E2A356', 'allowed': '#22c55e' };
        const legalOpacity = { 'no-go': 0.25, 'conditional': 0.20, 'allowed': 0.15 };
        const legalLabel = { 'no-go': 'Terlarang', 'conditional': 'Bersyarat', 'allowed': 'Diizinkan' };
        forestryLayer = L.geoJSON(data, {
          style: f => {
            const s = f.properties.legal_status || 'allowed';
            return {
              color: legalColor[s] || '#888',
              fillColor: legalColor[s] || '#888',
              fillOpacity: legalOpacity[s] || 0.15,
              weight: 2
            };
          }
        }).addTo(map);
        forestryLayer.bindTooltip(f => {
          const p = f.properties;
          return `<b>Kawasan Hutan</b><br>Status: ${legalLabel[p.legal_status] || p.legal_status}<br>Kode: ${p.fungsitap || '-'}`;
        }, {sticky:true});
        const beltColors = { HIGH: '#9FD8BD', MEDIUM: '#E2A356', LOW: '#ef4444' };
        const beltLabels = { HIGH: 'High — Tier Tinggi', MEDIUM: 'Medium — Tier Sedang', LOW: 'Low — Tier Rendah' };
        const legend = L.control({position: 'bottomleft'});
        legend.onAdd = () => {
          const div = L.DomUtil.create('div', 'map-legend');
          div.style.cssText = 'background:rgba(14,21,37,0.9);padding:10px 14px;border-radius:6px;font-size:11px;color:#EEEAE0;border:1px solid rgba(238,234,224,0.1);';
          let html = '<div style="font-weight:600;margin-bottom:4px;">Sabuk Nikel</div>';
          for (const t of ['HIGH', 'MEDIUM', 'LOW']) {
            html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">' +
              `<span style="position:relative;display:inline-block;width:22px;height:4px;">` +
              `<span style="position:absolute;inset:0;border-top:4px solid #000;border-radius:1px;"></span>` +
              `<span style="position:absolute;inset:0;border-top:2px dashed ${beltColors[t]};"></span></span>` +
              `<span>${beltLabels[t]}</span></div>`;
          }
          html += '<div style="font-weight:600;margin:8px 0 4px;">Kawasan Hutan (Satupeta)</div>';
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#ef4444;"></span> No-Go (HL/HSA)</div>';
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#E2A356;"></span> Conditional (HP/HPT/HPK)</div>';
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#22c55e;"></span> Allowed (APL/default)</div>';
          html += '<div style="font-weight:600;margin:8px 0 4px;">Infrastruktur Hilirisasi</div>';
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;"><span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid #fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.8);font-size:9px;">🏭</span> <span style="color:#fbbf24;font-weight:600;">Smelter Internal ANTAM</span></div>';
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;"><span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid #38bdf8;font-size:9px;">🏭</span> Smelter Mitra / Offtaker</div>';
          div.innerHTML = html;
          return div;
        };
        legend.addTo(map);
      });
  }

  function loadSmelterMarkers() {
    INDONESIA_SMELTERS.forEach(s => {
      const isAntam = !!s.isAntam;
      const antamClass = isAntam ? ' antam-smelter' : '';
      const ringHtml = isAntam ? '<div class="smelter-gold-ring"></div>' : '';
      const icon = L.divIcon({
        className: 'custom-smelter-icon',
        html: `<div class="smelter-pin-icon${antamClass}" id="smelter-pin-${s.id}"><div class="smelter-pin-badge" title="${s.name}">🏭</div>${ringHtml}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const marker = L.marker([s.lat, s.lon], { icon: icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:var(--font-ui);min-width:220px;line-height:1.5;color:#000000;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
            <div style="font-weight:700;font-size:13px;color:${isAntam ? '#b45309' : '#0369a1'};">🏭 ${s.name}</div>
            ${isAntam ? '<span style="background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px;">ANTAM</span>' : ''}
          </div>
          <div style="font-size:11px;color:#000000;margin-bottom:3px;"><b>Operator:</b> ${s.company}</div>
          <div style="font-size:11px;color:#000000;margin-bottom:3px;"><b>Lokasi:</b> ${s.location}</div>
          <div style="font-size:11px;color:#000000;margin-bottom:3px;"><b>Teknologi:</b> ${s.type}</div>
          <div style="font-size:11px;color:#047857;font-weight:600;"><b>Kapasitas:</b> ${s.capacity}</div>
        </div>
      `);
      const tooltipLabel = `🏭 ${s.shortName}`;
      marker.bindTooltip(tooltipLabel, {
        direction: 'top',
        offset: [0, -14],
        className: `smelter-label${isAntam ? ' antam-label' : ''}`
      });
      marker._smelterData = s;
      smelterMarkers.push(marker);
    });
  }

  function pinpointNearestSmelter(center) {
    let nearest = null, minDist = Infinity;
    INDONESIA_SMELTERS.forEach(s => {
      const d = haversineKm(center[1], center[0], s.lat, s.lon);
      if (d < minDist) { minDist = d; nearest = s; }
    });
    if (!nearest) return null;

    currentNearestSmelter = { smelter: nearest, distanceKm: minDist };

    // Remove existing route line
    if (smelterLineLayer) { map.removeLayer(smelterLineLayer); smelterLineLayer = null; }

    // Reset previous smelter pin visual states
    document.querySelectorAll('.smelter-pin-icon').forEach(el => {
      el.classList.remove('active-target');
      const pulse = el.querySelector('.smelter-pin-pulse');
      if (pulse) pulse.remove();
    });

    // Add glowing radar pulse on nearest smelter marker
    const targetEl = document.getElementById(`smelter-pin-${nearest.id}`);
    if (targetEl) {
      targetEl.classList.add('active-target');
      const pulseDiv = document.createElement('div');
      pulseDiv.className = 'smelter-pin-pulse';
      targetEl.appendChild(pulseDiv);
    }

    // Draw connecting dashed route line with distance indicator
    smelterLineLayer = L.featureGroup().addTo(map);

    L.polyline([[center[1], center[0]], [nearest.lat, nearest.lon]], {
      color: '#38bdf8',
      weight: 2.5,
      opacity: 0.85,
      dashArray: '8 6'
    }).addTo(smelterLineLayer);

    const midLat = (center[1] + nearest.lat) / 2;
    const midLon = (center[0] + nearest.lon) / 2;
    L.marker([midLat, midLon], {
      icon: L.divIcon({
        className: 'custom-smelter-icon',
        html: `<div class="smelter-dist-pill">✈️ ~${minDist.toFixed(1)} km ke ${nearest.shortName}</div>`,
        iconAnchor: [90, 12]
      }),
      interactive: false
    }).addTo(smelterLineLayer);

    return currentNearestSmelter;
  }

  function setupDrawControl() {
    drawnItems = L.featureGroup().addTo(map);
    drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: false, polyline: false, circle: false,
        circlemarker: false, marker: false, rectangle: true
      }
    });

    $('btnSelect').addEventListener('click', () => {
      if (_drawingActive) {
        _drawingActive = false;
        $('btnSelect').classList.remove('btn-active');
        if (activeDrawHandler) { activeDrawHandler.disable(); activeDrawHandler = null; }
        if (drawControl) { map.removeControl(drawControl); drawControl = null; }
        drawnItems.clearLayers();
        $('mapHint').classList.add('hidden');
        return;
      }
      _drawingActive = true;
      $('btnSelect').classList.add('btn-active');
      if (drawControl) map.removeControl(drawControl);
      drawControl = null;
      setTimeout(() => {
        drawnItems.clearLayers();
        drawControl = new L.Control.Draw({
          edit: { featureGroup: drawnItems },
          draw: {
            polygon: false, polyline: false, circle: false,
            circlemarker: false, marker: false, rectangle: true
          }
        });
        map.addControl(drawControl);
        activeDrawHandler = new L.Draw.Rectangle(map);
        activeDrawHandler.enable();
        $('mapHint').textContent = 'Draw a rectangle on the map to select exploration area';
        $('mapHint').classList.remove('hidden');
      }, 50);
    });

    map.on(L.Draw.Event.CREATED, e => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      const b = e.layer.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const center = [(b.getWest() + b.getEast()) / 2, (b.getSouth() + b.getNorth()) / 2];
      const params = findNearestSite(center);
      currentBbox = bbox;
      currentParams = params;
      currentGrid = generateGrid(bbox, params, forestryData);
      pinpointNearestSmelter(center);
      _drawingActive = false;
      activeDrawHandler = null;
      mlResults = null;
      mlError = null;
      enterTargetMode(params);
    });

    $('btnClear').addEventListener('click', resetToBrowse);
  }

  function pointInPolygon(lon, lat, poly) {
    const ring = poly[0];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function findNearestSite(center) {
    const inBelt = beltPolygons && beltPolygons.features.some(f =>
      pointInPolygon(center[0], center[1], f.geometry.coordinates)
    );
    let nearest = null, minDist = Infinity;
    sites.forEach(s => {
      const c = s.geometry.coordinates;
      const d = Math.sqrt((c[0] - center[0]) ** 2 + (c[1] - center[1]) ** 2);
      if (d < minDist) { minDist = d; nearest = s; }
    });

    if (nearest && inBelt) {
      const p = nearest.properties;
      // If within ~45km (0.4 deg) of known deposit site
      if (minDist < 0.4) {
        return {
          id: p.id, name: p.name, province: p.province,
          terrain_class: p.terrain_class, tier: p.tier,
          elevation_mean: p.elevation_mean, elevation_max: p.elevation_max,
          elevation_min: p.elevation_min, slope_mean: p.slope_mean,
          inBelt: true, prefix: p.id.slice(0, 3).toUpperCase()
        };
      }
      // Greenfield area inside Indonesian nickel belt
      const province = center[0] > 125 ? 'Maluku Utara' : (center[1] > -1.5 ? 'Sulawesi Tengah' : (center[0] > 121.8 ? 'Sulawesi Tenggara' : 'Sulawesi Selatan'));
      const tier = minDist < 1.0 ? 'MEDIUM' : 'LOW';
      return {
        id: 'greenfield_' + Math.abs(Math.floor(center[0] * 10 + center[1] * 100)),
        name: `Sektor Eksplorasi (${nearest.properties.name} Ext.)`,
        province: province,
        terrain_class: p.terrain_class || 'ROLLING',
        tier: tier,
        elevation_mean: p.elevation_mean || 250,
        elevation_max: p.elevation_max || 500,
        elevation_min: p.elevation_min || 80,
        slope_mean: p.slope_mean || 12,
        inBelt: true,
        prefix: 'EXP'
      };
    }

    return {
      id: 'custom', name: 'Non-Belt Greenfield', province: 'Indonesia',
      terrain_class: 'ROLLING', tier: 'LOW',
      elevation_mean: 150, elevation_max: 300, elevation_min: 30,
      slope_mean: 8, inBelt: false, prefix: 'GEN'
    };
  }

  function enterTargetMode(params) {
    $('mapHint').classList.add('hidden');
    $('btnSelect').classList.remove('btn-active');

    const assessment = computeAssessment(currentGrid.cells, params);
    showGrid();
    showAssessment(assessment, params);
    _3dRendered = false;
    _3dRenderedWithMl = false;
    fetchElevationData(currentGrid.cells);

    // Fire ML inference call — async, UI updates when results arrive
    callBackendMl();

    // Open panel (slide up from bottom)
    const panel = $('targetPanel');
    panel.classList.remove('expanded');
    panel.classList.add('open');
    updateExpandBtn();
    switchTab('assessment');
  }

  function resetToBrowse() {
    $('targetPanel').classList.remove('open');
    $('targetPanel').classList.remove('expanded');
    updateExpandBtn();
    $('mapHint').textContent = 'Select "Select Area" then draw a rectangle on the map to begin exploration';
    $('mapHint').classList.remove('hidden');
    if (gridLayer) { map.removeLayer(gridLayer); gridLayer = null; }
    if (gridMlLayer) { map.removeLayer(gridMlLayer); gridMlLayer = null; }
    if (smelterLineLayer) { map.removeLayer(smelterLineLayer); smelterLineLayer = null; }
    document.querySelectorAll('.smelter-pin-icon').forEach(el => {
      el.classList.remove('active-target');
      const pulse = el.querySelector('.smelter-pin-pulse');
      if (pulse) pulse.remove();
    });
    currentNearestSmelter = null;
    $('mlExplanation').innerHTML = '';
    drawnItems.clearLayers();
    if (drawControl) { map.removeControl(drawControl); drawControl = null; }
    drawnItems = L.featureGroup().addTo(map);
    drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: false, polyline: false, circle: false,
        circlemarker: false, marker: false, rectangle: true
      }
    });
    _drawingActive = false;
    activeDrawHandler = null;
    _3dRendered = false;
    _3dRenderedWithMl = false;
    _elevationLoading = false;
    _3dMesh = null;
    ['mlTotalCells','mlHighCount','mlMedCount','mlLowCount','mlTopTarget'].forEach(id => safeSet(id, '-'));
    ['compAllowed','compConditional','compNoGo'].forEach(id => safeSet(id, '-'));
    currentBbox = null;
    currentGrid = null;
    currentParams = null;
    mlResults = null;
    mlError = null;
    mlLoading = false;
  }

  // ----- Backend ML (with client-side fallback) -----
  function callBackendMl() {
    if (!currentGrid || !Array.isArray(currentGrid.features)) return;
    mlLoading = true;
    mlResults = null;
    mlError = null;
    safeSet('mlTotalCells', '...');
    safeSet('mlHighCount', '...');
    safeSet('mlMedCount', '...');
    safeSet('mlLowCount', '...');
    safeSet('mlTopTarget', 'Loading...');

    const feat = f => f && f.properties ? f.properties : {};
    let grids;
    try {
      grids = currentGrid.features.map(f => {
        const p = feat(f);
        const coords = f?.geometry?.coordinates;
        const ring = Array.isArray(coords) && coords[0];
        const lon0 = ring?.[0]?.[0], lat0 = ring?.[0]?.[1];
        const lon2 = ring?.[2]?.[0], lat2 = ring?.[2]?.[1];
        return {
          grid_id: p.grid_id || '',
          latitude: (lat0 != null && lat2 != null) ? (lat0 + lat2) / 2 : 0,
          longitude: (lon0 != null && lon2 != null) ? (lon0 + lon2) / 2 : 0,
          slope_deg: p.slope_deg || 0,
          distance_to_river_m: p.distance_to_river_m || 9999,
          distance_to_road_m: p.distance_to_road_m || 9999,
          distance_to_smelter_km: p.distance_to_smelter_km || 999,
          area_ha: p.area_ha || 0,
          lithology: p.lithology || 'unknown',
          legal_status: p.legal_status || 'unknown'
        };
      });
    } catch (e) {
      mlLoading = false;
      mlError = 'Failed to build grid features: ' + e.message;
      showMlMap();
      return;
    }

    // Try backend first, fall back to client-side ML
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch(`${API_BASE}/api/analyze-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grids }),
      signal: controller.signal
    })
      .then(r => { clearTimeout(timer); if (!r.ok) throw new Error('Server error ' + r.status); return r.json(); })
      .then(data => {
        mlResults = {};
        (data.results || []).forEach(r => { mlResults[r.grid_id] = r; });
        mlLoading = false;
        mlError = null;
        console.info('ML results from backend server');
        showMlMap();
        showExportTable();
      })
      .catch(err => {
        clearTimeout(timer);
        console.warn('Backend unavailable, using client-side ML engine:', err.message);
        // ── Client-side fallback ──
        try {
          const data = NiTerraML.analyzeBatch(grids);
          mlResults = {};
          (data.results || []).forEach(r => { mlResults[r.grid_id] = r; });
          mlLoading = false;
          mlError = null;
          console.info('ML results from client-side engine (' + data.success_count + ' cells)');
          showMlMap();
          showExportTable();
        } catch (fallbackErr) {
          mlLoading = false;
          mlError = 'Both backend and client-side ML failed: ' + fallbackErr.message;
          try { showMlMap(); } catch (e) { console.error('showMlMap crashed:', e); }
        }
      });
  }

  function showGrid() {
    if (gridLayer) { map.removeLayer(gridLayer); gridLayer = null; }
    const legalColor = s => s === 'no-go' ? '#ef4444' : s === 'conditional' ? '#E2A356' : '#10b981';
    const legalOpacity = s => s === 'no-go' ? 0.25 : s === 'conditional' ? 0.18 : 0.10;
    gridLayer = L.geoJSON(currentGrid, {
      style: f => ({
        color: legalColor(f.properties.legal_status),
        fillColor: legalColor(f.properties.legal_status),
        fillOpacity: legalOpacity(f.properties.legal_status),
        weight: 0.8
      })
    }).addTo(map);
    gridLayer.bindTooltip(f => `<b>${f.feature.properties.grid_id}</b><br>Legal: ${f.feature.properties.legal_status}<br>Lith: ${f.feature.properties.lithology}`, {sticky:true});
    map.fitBounds(gridLayer.getBounds().pad(0.05));
  }

  // ----- Assessment (Continuous Dynamic Scoring) -----
  function computeAssessment(cells, params) {
    if (!cells || !cells.length) {
      return { safety: 0, probable: 0, worth: 0, overall: 0, recommendation: 'NO-GO', avgSlope: 0, avgRoad: 0, ultraPct: 0, totalArea: 0, avgSmelter: 0 };
    }
    const avg = (arr, fn) => { const v = arr.map(fn); return v.reduce((a, b) => a + b, 0) / v.length; };
    const avgSlope = avg(cells, c => c.slope);
    const avgRoad = avg(cells, c => c.road);
    
    // Count all ultramafic rock families
    const ULTRA_FAMILIES = ['serpentinite', 'peridotite', 'ultramafic', 'dunite', 'harzburgite', 'lherzolite', 'pyroxenite'];
    const isUltra = lith => ULTRA_FAMILIES.some(u => (lith || '').toLowerCase().includes(u));
    const ultraCount = cells.filter(c => isUltra(c.lith)).length;
    const ultraPct = (ultraCount / cells.length) * 100;
    
    const totalArea = cells.reduce((s, c) => s + (c.area || 0), 0);
    const avgSmelter = avg(cells, c => c.smelter);

    // 1. Keselamatan Operasi (Continuous Safety Index: 0-100)
    // - Flatter slopes = higher safety score
    const slopeScore = Math.max(15, Math.min(100, 100 - (avgSlope * 3.2)));
    // - Proximity to existing access roads
    const roadScore = Math.max(30, Math.min(100, 100 - ((avgRoad / 3500) * 55)));
    // - Legal safety (Penalize overlaps with Hutan Lindung/Hutan Produksi)
    const noGoCount = cells.filter(c => c.legal === 'no-go').length;
    const condCount = cells.filter(c => c.legal === 'conditional').length;
    const legalSafetyScore = Math.max(10, 100 - ((noGoCount / cells.length) * 70) - ((condCount / cells.length) * 25));
    // - Terrain roughness baseline
    const terrainBase = { FLAT: 95, ROLLING: 85, HILLY: 65, MOUNTAINOUS: 45 }[params.terrain_class] || 70;

    const safety = Math.max(10, Math.min(99, Math.round(
      slopeScore * 0.35 + roadScore * 0.25 + legalSafetyScore * 0.25 + terrainBase * 0.15
    )));

    // 2. Probabilitas Geologis (Continuous Geology Index: 0-100)
    // - Real ultramafic lithology concentration (0 - 100)
    const ultraScore = Math.max(10, Math.min(100, ultraPct));
    // - Tier baseline
    const tierScore = { HIGH: 95, MEDIUM: 65, LOW: 30 }[params.tier] || 35;
    // - Regional Nickel Belt membership
    const beltScore = params.inBelt ? 100 : 15;

    const probable = Math.max(5, Math.min(99, Math.round(
      ultraScore * 0.50 + beltScore * 0.30 + tierScore * 0.20
    )));

    // 3. Kelayakan Ekonomi (Continuous Economics Index: 0-100)
    // - Real distance to nearest operational smelter
    const clon = avg(cells, c => c.lonC);
    const clat = avg(cells, c => c.latC);
    let nearestSmelter = null, minSmelterDist = Infinity;
    INDONESIA_SMELTERS.forEach(s => {
      const d = haversineKm(clat, clon, s.lat, s.lon);
      if (d < minSmelterDist) { minSmelterDist = d; nearestSmelter = s; }
    });

    const smelterScore = Math.max(15, Math.min(100, Math.round(100 - Math.min(85, avgSmelter * 0.45))));
    // - Deposit footprint / scale
    const areaScore = Math.max(25, Math.min(100, Math.round(Math.min(100, 30 + (totalArea / 500) * 70))));
    // - Operability & market tier
    const econTierScore = { HIGH: 95, MEDIUM: 65, LOW: 35 }[params.tier] || 40;

    const worth = Math.max(10, Math.min(99, Math.round(
      smelterScore * 0.45 + areaScore * 0.30 + econTierScore * 0.25
    )));

    let overall = Math.round(safety * 0.30 + probable * 0.45 + worth * 0.25);
    let recommendation = overall >= 75 ? 'GO' : overall >= 50 ? 'CONDITIONAL' : 'NO-GO';
    if (!params.inBelt) {
      overall = Math.min(25, overall);
      recommendation = 'NO-GO';
    }

    return { safety, probable, worth, overall, recommendation, avgSlope, avgRoad, ultraPct, totalArea, avgSmelter, nearestSmelter, minSmelterDist };
  }

  function showAssessment(a, params) {
    const cells = currentGrid.cells;
    const nNoGo = cells.filter(c => c.legal === 'no-go').length;
    const nCond = cells.filter(c => c.legal === 'conditional').length;
    const nAllowed = cells.filter(c => c.legal === 'allowed').length;
    $('compNoGo').textContent = nNoGo;
    $('compConditional').textContent = nCond;
    $('compAllowed').textContent = nAllowed;
    if (nNoGo > 0) {
      $('complianceRow').querySelectorAll('.assess-badge.nogo')[0].style.background = 'rgba(239,68,68,0.2)';
    }

    const banner = $('overallBanner');
    const verdicts = {GO: 'GO', CONDITIONAL: 'BERSYARAT', 'NO-GO': 'BATALKAN'};
    const descs = {GO: 'DEPLOY DRONE TEAM', CONDITIONAL: 'Evaluasi lanjutan diperlukan', 'NO-GO': 'Area tidak prospektif'};
    const v = verdicts[a.recommendation] || '—';
    const d = descs[a.recommendation] || '—';
    $('bannerVerdict').textContent = v;
    $('bannerDesc').textContent = d;
    banner.className = `assess-hero-banner banner-${a.recommendation.toLowerCase()}`;
    // Update SVG icon based on recommendation
    const iconSvgs = {
      GO: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      CONDITIONAL: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      'NO-GO': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };
    const iconEl = banner.querySelector('.banner-status-icon');
    if (iconEl) iconEl.innerHTML = iconSvgs[a.recommendation] || iconSvgs['GO'];

    const setScore = (id, barId, val) => {
      const el = $(id);
      if (el) {
        el.textContent = val;
        el.className = 'score-big';
      }
      const barEl = $(barId);
      if (barEl) barEl.style.width = Math.min(100, Math.max(0, val)) + '%';
    };
    setScore('scoreSafety', 'barSafety', a.safety);
    setScore('scoreProb', 'barProb', a.probable);
    setScore('scoreWorth', 'barWorth', a.worth);

    $('detailSafety').textContent =
      `Slope avg ${a.avgSlope.toFixed(1)}° (${a.avgSlope < 8 ? 'gentle' : a.avgSlope < 15 ? 'moderate' : 'steep'}) ` +
      `Road avg ${Math.round(a.avgRoad)}m Terrain: ${params.terrain_class}`;
    $('detailProb').textContent =
      `Ultramafic ${a.ultraPct.toFixed(0)}% Tier: ${params.tier} ${params.inBelt ? 'Inside nickel belt' : 'Outside known belt'}`;
    
    const smelterTitle = a.nearestSmelter ? `${a.nearestSmelter.shortName} (~${a.avgSmelter.toFixed(1)} km)` : `~${a.avgSmelter.toFixed(0)} km`;
    $('detailWorth').textContent =
      `Smelter: ${smelterTitle} • Area: ${a.totalArea.toFixed(0)} ha • Tier: ${params.tier}`;
    const siteInfoEl = $('siteInfo');
    const siteText = params.inBelt
      ? `${params.name}, ${params.province} — ${params.terrain_class} terrain — ${currentGrid.features.length} grid cells`
      : `Area tidak berada di sabuk nikel — tidak ada potensi laterit.`;
    // siteInfo now has a child span structure; update the text span
    const siteTextSpan = siteInfoEl.querySelector('span:last-child');
    if (siteTextSpan) siteTextSpan.textContent = siteText;
    else siteInfoEl.textContent = siteText;
  }

  // ----- 3D Terrain -----
  var _3dAnimFrame = null, _3dResizeObserver = null, _3dCleanups = [];

  function showTerrain3D() {
    if (!currentGrid || !currentGrid.cells) return;
    const container = document.getElementById("terrain3dContainer");
    if (!container) return;

    // Dispose previous Three.js resources
    if (_3dAnimFrame) { cancelAnimationFrame(_3dAnimFrame); _3dAnimFrame = null; }
    if (_3dResizeObserver) { _3dResizeObserver.disconnect(); _3dResizeObserver = null; }
    _3dCleanups.forEach(function(fn) { fn(); });
    _3dCleanups = [];
    // Remove only Three.js canvas and label elements (keep overlays)
    container.querySelectorAll('canvas, .three-label').forEach(function(el) { el.remove(); });

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1525);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    camera.position.set(10, 8, 12);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x8888ff, 0.3);
    dir2.position.set(-3, 5, -5);
    scene.add(dir2);

    // Axis labels
    var labelDiv = document.createElement("div");
    labelDiv.className = 'three-label';
    labelDiv.style.cssText = "position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-family:var(--font-ui);font-size:11px;color:rgba(238,234,224,0.5);pointer-events:none;";
    labelDiv.textContent = "Longitude \u2192";
    container.appendChild(labelDiv);
    var labelDiv2 = document.createElement("div");
    labelDiv2.className = 'three-label';
    labelDiv2.style.cssText = "position:absolute;top:50%;left:4px;transform:translateY(-50%) rotate(-90deg);font-family:var(--font-ui);font-size:11px;color:rgba(238,234,224,0.5);pointer-events:none;white-space:nowrap;";
    labelDiv2.textContent = "Latitude \u2192";
    container.appendChild(labelDiv2);

    // Compute terrain dimensions (used for ground/grid too)
    const cells = currentGrid && currentGrid.cells;
    var terrainWidth = 16, terrainDepth = 16;
    if (cells && cells.length) {
      var NY = 0, NX = 0;
      const lats = cells.map(function(c) { return c.latC; });
      const lons = cells.map(function(c) { return c.lonC; });
      var uniqueLats = lats.filter(function(v, i, a) { return a.indexOf(v) === i; });
      NY = uniqueLats.length || 20;
      NX = Math.round(cells.length / NY) || 20;
      const latMin = Math.min.apply(null, lats);
      const latMax = Math.max.apply(null, lats);
      const lonMin = Math.min.apply(null, lons);
      const lonMax = Math.max.apply(null, lons);
      const latSpan = latMax - latMin || 0.01;
      const lonSpan = lonMax - lonMin || 0.01;
      const aspect = lonSpan / latSpan;

      // Build elevation and color matrices
      var elevGrid = [], colorGrid = [];
      for (var row = 0; row < NY; row++) {
        elevGrid[row] = [];
        colorGrid[row] = [];
        for (var col = 0; col < NX; col++) {
          var c = cells[row * NX + col];
          var elev = c && c.elevation != null ? c.elevation : 20;
          elevGrid[row][col] = elev;

          var score = (function(id) {
            var r = mlResults ? mlResults[id] : null;
            if (!r || r.ml_score == null) return null;
            return r.ml_masked ? 0 : r.ml_score;
          })(c && c.gid);

          var color = new THREE.Color();
          if (score != null) {
            color.setHex(score >= 6.5 ? 0x10b981 : score >= 3.5 ? 0xE2A356 : 0xef4444);
          } else if (c) {
            color.setHex(c.legal === "no-go" ? 0xef4444 : c.legal === "conditional" ? 0xE2A356 : 0x10b981);
          } else {
            color.setHex(0x10b981);
          }
          colorGrid[row][col] = color;
        }
      }

      // Scale terrain
      terrainWidth = 2 * aspect * 8;
      terrainDepth = 2 * 8;
      var elevMin = Infinity, elevMax = -Infinity;
      for (var r = 0; r < NY; r++) {
        for (var c2 = 0; c2 < NX; c2++) {
          var v = elevGrid[r][c2];
          if (v < elevMin) elevMin = v;
          if (v > elevMax) elevMax = v;
        }
      }
      var elevRange = elevMax - elevMin || 1;
      var heightScale = 3.0 / elevRange; // auto-scale

      // Create PlaneGeometry
      var geo = new THREE.PlaneGeometry(terrainWidth, terrainDepth, NX - 1, NY - 1);
      geo.rotateX(-Math.PI / 2);

      var pos = geo.attributes.position;
      var colors = new Float32Array(pos.count * 3);

      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), z = pos.getZ(i); // after rotation, y is up
        // Map back to grid coordinates
        var u = (x + terrainWidth / 2) / terrainWidth;
        var v2 = (z + terrainDepth / 2) / terrainDepth;
        var col = Math.min(NX - 1, Math.floor(u * NX));
        var row2 = Math.min(NY - 1, Math.floor(v2 * NY));
        col = Math.max(0, Math.min(NX - 1, col));
        row2 = Math.max(0, Math.min(NY - 1, row2));

        var height = (elevGrid[row2][col] - elevMin) * heightScale;
        pos.setY(i, height);

        var clr = colorGrid[row2][col];
        colors[i * 3] = clr.r;
        colors[i * 3 + 1] = clr.g;
        colors[i * 3 + 2] = clr.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pos.needsUpdate = true;

      geo.computeVertexNormals();

      var mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false,
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      _3dMesh = mesh;

      // Add low-opacity grid ID text labels floating over 3D terrain cells
      if (cells && cells.length) {
        cells.forEach(function(c) {
          if (!c.gid) return;
          var u = (c.col + 0.5) / NX;
          var v = (c.row + 0.5) / NY;
          var px = (u - 0.5) * terrainWidth;
          var pz = (v - 0.5) * terrainDepth;
          var h = ((c.elevation || 0) - elevMin) * heightScale;
          
          var lCanvas = document.createElement('canvas');
          lCanvas.width = 128; lCanvas.height = 64;
          var lCtx = lCanvas.getContext('2d');
          lCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          lCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          lCtx.lineWidth = 2;
          lCtx.beginPath();
          lCtx.rect(12, 8, 104, 48);
          lCtx.fill(); lCtx.stroke();
          
          lCtx.font = 'Bold 24px "Space Grotesk", sans-serif';
          lCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          lCtx.textAlign = 'center';
          lCtx.textBaseline = 'middle';
          lCtx.fillText(c.gid, 64, 33);
          
          var lTex = new THREE.CanvasTexture(lCanvas);
          var lMat = new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.70, depthTest: false });
          var lSprite = new THREE.Sprite(lMat);
          lSprite.scale.set(1.6, 0.8, 1);
          lSprite.position.set(px, h + 0.7, pz);
          scene.add(lSprite);
        });
      }

      // Populate metric overlay
      var eOverlay = document.getElementById('terrainMetricOverlay');
      if (eOverlay) eOverlay.style.display = '';
      if (cells && cells.length) {
        var eMin = Math.min.apply(null, cells.map(function(c) { return c.elevation != null ? c.elevation : 0; }));
        var eMax = Math.max.apply(null, cells.map(function(c) { return c.elevation != null ? c.elevation : 0; }));
        document.getElementById('tmElevRange').textContent = eMin.toFixed(0) + ' - ' + eMax.toFixed(0) + ' m';
        document.getElementById('tmGridCount').textContent = cells.length;
        var mlScores = cells.map(function(c) { return mlResults && mlResults[c.gid] && mlResults[c.gid].ml_score != null ? mlResults[c.gid].ml_score : null; }).filter(function(s) { return s != null; });
        document.getElementById('tmMlAvg').textContent = mlScores.length ? (mlScores.reduce(function(a, b) { return a + b; }, 0) / mlScores.length).toFixed(2) : '-';
      }
      // ponytail: height ruler with sprite label at the line top
      var _hRuler = elevRange * heightScale;
      var _hTop = _hRuler * 1.05;
      var _rx = terrainWidth / 2, _rz = -terrainDepth / 2;

      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(_rx, 0, _rz),
          new THREE.Vector3(_rx, _hTop, _rz)
        ]),
        new THREE.LineBasicMaterial({ color: 0x00ffff })
      ));

      var _sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
      );
      _sphere.position.set(_rx, _hTop, _rz);
      scene.add(_sphere);

      var _labelCanvas = document.createElement('canvas');
      _labelCanvas.width = 128;
      _labelCanvas.height = 48;
      var _ctx = _labelCanvas.getContext('2d');
      _ctx.fillStyle = 'rgba(14,21,37,0.85)';
      _ctx.fillRect(4, 4, 120, 32);
      _ctx.strokeStyle = 'rgba(0,255,255,0.3)';
      _ctx.lineWidth = 1;
      _ctx.strokeRect(4, 4, 120, 32);
      _ctx.fillStyle = '#00ffff';
      _ctx.font = 'bold 24px monospace';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(elevMax.toFixed(0) + ' m', 64, 20);
      var _labelTex = new THREE.CanvasTexture(_labelCanvas);
      _labelTex.minFilter = THREE.LinearFilter;
      var _labelMat = new THREE.SpriteMaterial({ map: _labelTex, transparent: true, depthWrite: false });
      var _labelSprite = new THREE.Sprite(_labelMat);
      _labelSprite.position.set(_rx, _hTop + 0.25, _rz);
      scene.add(_labelSprite);
      _labelSprite.userData.baseScale = camera.position.distanceTo(_labelSprite.position);
      _labelSprite.scale.set(3.2, 1.2, 1);
    }

    // Ground plane
    var groundGeo = new THREE.PlaneGeometry(terrainWidth * 1.2, terrainDepth * 1.2);
    var groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, side: THREE.DoubleSide, transparent: true, opacity: 0.4, roughness: 1 });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    // Grid helper
    var gridSize = Math.max(terrainWidth, terrainDepth);
    var gridDivisions = Math.round(gridSize);
    var gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x333355, 0x222244);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // OrbitControls
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // Render loop
    function animate3d() {
      _3dAnimFrame = requestAnimationFrame(animate3d);
      controls.update();
      if (_labelSprite) {
        var _dist = camera.position.distanceTo(_labelSprite.position);
        var _s = _dist / _labelSprite.userData.baseScale;
        _labelSprite.scale.set(1.6 * _s, 0.6 * _s, 1);
      }
      renderer.render(scene, camera);
    }
    animate3d();

    // ResizeObserver
    _3dResizeObserver = new ResizeObserver(function() {
      var w2 = container.clientWidth;
      var h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });
    _3dResizeObserver.observe(container);

    // Dispose Three.js resources on page leave
    var _clean3d = function() {
      cancelAnimationFrame(_3dAnimFrame);
      renderer.dispose();
    };
    window.addEventListener('beforeunload', _clean3d);
    _3dCleanups.push(_clean3d);
  }

  // ----- Elevation data (open-elevation API) -----
  function bilinearInterpolate(xFrac, yFrac, data) {
    if (!data || data.length < 2 || data[0].length < 2) return 0;
    var nLat = data.length, nLon = data[0].length;
    var ix = Math.min(Math.floor(xFrac * (nLon - 1)), nLon - 2);
    var iy = Math.min(Math.floor(yFrac * (nLat - 1)), nLat - 2);
    var fx = xFrac * (nLon - 1) - ix, fy = yFrac * (nLat - 1) - iy;
    var v00 = data[iy][ix], v10 = data[iy][ix + 1];
    var v01 = data[iy + 1][ix], v11 = data[iy + 1][ix + 1];
    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  }

  function fetchElevationData(cells) {
    if (!cells || !cells.length || _elevationLoading) return;
    var spinner = document.getElementById("elevation-spinner");
    if (spinner) { spinner.style.display = "flex"; document.getElementById("elevationStatus").textContent = "Loading elevation from terrain tiles..."; }
    _elevationLoading = true;

    var lats = cells.map(function(c) { return c.latC; });
    var lons = cells.map(function(c) { return c.lonC; });
    var latMin = Math.min.apply(null, lats);
    var latMax = Math.max.apply(null, lats);
    var lonMin = Math.min.apply(null, lons);
    var lonMax = Math.max.apply(null, lons);
    var maxSpan = Math.max(latMax - latMin, lonMax - lonMin) || 0.01;

    // Choose zoom: aim for the area to span ~256 pixels across.
    // Cap tile count by adjusting zoom down for very large areas.
    var zoom = Math.min(15, Math.max(10, Math.ceil(Math.log2(360 / maxSpan))));

    // Collect unique tiles and group cells by tile
    var tileCells = {};
    cells.forEach(function(c) {
      var tx = Math.floor((c.lonC + 180) / 360 * (1 << zoom));
      var latRad = c.latC * Math.PI / 180;
      var ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * (1 << zoom));
      var key = zoom + '/' + tx + '/' + ty;
      if (!tileCells[key]) tileCells[key] = [];
      tileCells[key].push(c);
    });

    var tileKeys = Object.keys(tileCells);

    // If too many tiles, lower zoom
    if (tileKeys.length > 16) {
      zoom = Math.max(10, zoom - 1);
      tileCells = {};
      cells.forEach(function(c) {
        var tx = Math.floor((c.lonC + 180) / 360 * (1 << zoom));
        var latRad = c.latC * Math.PI / 180;
        var ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * (1 << zoom));
        var key = zoom + '/' + tx + '/' + ty;
        if (!tileCells[key]) tileCells[key] = [];
        tileCells[key].push(c);
      });
      tileKeys = Object.keys(tileCells);
    }

    var loaded = 0, total = tileKeys.length;

    tileKeys.forEach(function(key) {
      var parts = key.split('/');
      var z = parseInt(parts[0]), x = parseInt(parts[1]), y = parseInt(parts[2]);
      var url = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png';
      var canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      var ctx = canvas.getContext('2d');

      fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(function(blob) {
          var img = new Image();
          img.onload = function() {
            ctx.drawImage(img, 0, 0);
            var imgData = ctx.getImageData(0, 0, 256, 256);
            (tileCells[key] || []).forEach(function(cell) {
              var latRad2 = cell.latC * Math.PI / 180;
              var px = Math.min(255, Math.max(0, Math.floor((((cell.lonC + 180) / 360 * (1 << z)) % 1) * 256)));
              var py = Math.min(255, Math.max(0, Math.floor((((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * (1 << z)) % 1) * 256)));
              var idx = (py * 256 + px) * 4;
              var r_ = imgData.data[idx], g_ = imgData.data[idx + 1], b_ = imgData.data[idx + 2];
              cell.elevation = (r_ * 256 + g_ + b_ / 256) - 32768;
            });
            loaded++;
            if (spinner) document.getElementById("elevationStatus").textContent = 'Elevation tiles: ' + loaded + '/' + total;
            if (loaded === total) finish();
          };
          img.onerror = function() { loaded++; if (loaded === total) finish(); };
          img.src = URL.createObjectURL(blob);
        })
        .catch(function() {
          loaded++; if (loaded === total) finish();
        });
    });

    function finish() {
      cells.forEach(function(c) {
        if (c.elevation == null || isNaN(c.elevation)) c.elevation = 0;
      });
      _elevationLoading = false;
      if (spinner) spinner.style.display = 'none';
      if (_3dRendered) showTerrain3D();
    }

    if (total === 0) finish();
  }
  // ----- ML Explanation -----
  function showMlMap() {
    if (!currentGrid) return;
    const container = $('mlExplanation');

    if (mlError) {
      safeSet('mlTotalCells', 'Error');
      safeSet('mlHighCount', '-');
      safeSet('mlMedCount', '-');
      safeSet('mlLowCount', '-');
      safeSet('mlTopTarget', '-');
      if (gridMlLayer) { map.removeLayer(gridMlLayer); gridMlLayer = null; }
      container.innerHTML = `<div class="ml-verdict low"><span class="verdict-icon">⚠️</span><div class="verdict-text"><h3>Analisis Gagal</h3><p>${mlError}</p></div></div>`;
      return;
    }
    if (!mlResults) {
      safeSet('mlTotalCells', '...');
      safeSet('mlHighCount', '...');
      safeSet('mlMedCount', '...');
      safeSet('mlLowCount', '...');
      safeSet('mlTopTarget', 'Loading...');
      container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:20px;">Memproses prospektivitas grid...</p>';
      return;
    }

    const getScore = (id) => {
      const r = mlResults[id];
      if (!r || r.ml_score == null) return null;
      return r.ml_masked ? 0 : r.ml_score;
    };

    const cells = currentGrid.cells.map(c => ({
      ...c,
      score: getScore(c.gid),
      result: mlResults[c.gid] || {}
    }));

    const scored = cells.filter(c => c.score != null);
    const high = scored.filter(c => c.score >= 6.5);
    const med = scored.filter(c => c.score >= 3.5 && c.score < 6.5);
    const low = scored.filter(c => c.score < 3.5);
    const total = scored.length;
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const top = sorted[0];

    // Update stat cards
    safeSet('mlTotalCells', total);
    safeSet('mlHighCount', high.length + ' (' + (total ? Math.round(high.length / total * 100) : 0) + '%)');
    safeSet('mlMedCount', med.length + ' (' + (total ? Math.round(med.length / total * 100) : 0) + '%)');
    safeSet('mlLowCount', low.length + ' (' + (total ? Math.round(low.length / total * 100) : 0) + '%)');
    safeSet('mlTopTarget', top ? top.gid + ' @ ' + top.score.toFixed(2) : '-');

    // Update main map grid overlay with ML colors
    if (gridMlLayer) { map.removeLayer(gridMlLayer); gridMlLayer = null; }
    const scoreColor = s => s >= 6.5 ? '#10b981' : s >= 3.5 ? '#E2A356' : '#ef4444';
    const feats = currentGrid.features.map(f => {
      const r = mlResults[f.properties.grid_id];
      const s = r && r.ml_score != null ? (r.ml_masked ? 0 : r.ml_score) : 0;
      return {
        type: 'Feature',
        properties: { grid_id: f.properties.grid_id, score: s },
        geometry: f.geometry
      };
    });
    gridMlLayer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
      style: f => ({
        color: scoreColor(f.properties.score),
        fillColor: scoreColor(f.properties.score),
        fillOpacity: 0.45,
        weight: 0.5
      })
    }).addTo(map);
    gridMlLayer.bindTooltip(f => `<b>${f.properties.grid_id}</b><br>Score: ${f.properties.score.toFixed(2)}`, {sticky:true});

    // ── Build simplified UI HTML ──
    let html = '';

    // 1. Executive Summary / Verdict
    const verdictClass = high.length > 5 ? 'high' : high.length > 0 ? 'medium' : 'low';
    const verdictIcon = high.length > 5 ? '🎯' : high.length > 0 ? '🔎' : '⚠️';
    const verdictTitle = high.length > 5 ? 'Prospektivitas Sangat Baik' : high.length > 0 ? 'Terdapat Target Potensial' : 'Prospektivitas Rendah';
    const verdictDesc = high.length > 0
      ? `Ditemukan <b>${high.length} sel</b> (${total ? Math.round(high.length / total * 100) : 0}%) dengan skor prospektivitas tinggi (&ge;6.5). Direkomendasikan sebagai prioritas survei drone.`
      : `Tidak ditemukan sel dengan skor tinggi. Sebagian besar area memiliki indikator geologis atau legal yang kurang mendukung.`;

    // 1.5 Lithology Composition (Donut Chart calculations)
    let ultraCount = 0, maficCount = 0, otherCount = 0;
    const ultraTypes = ['serpentinite', 'peridotite', 'ultramafic', 'dunite', 'harzburgite', 'lherzolite', 'pyroxenite'];
    const maficTypes = ['gabbro', 'basalt', 'mafic_volcanic', 'mafic'];
    
    scored.forEach(c => {
      let l = (c.lith || 'unknown').replace('_simulated', '').toLowerCase();
      if (ultraTypes.some(k => l.includes(k))) ultraCount++;
      else if (maficTypes.some(k => l.includes(k))) maficCount++;
      else otherCount++;
    });
    
    const ultraPct = total ? Math.round((ultraCount / total) * 100) : 0;
    const maficPct = total ? Math.round((maficCount / total) * 100) : 0;
    const otherPct = total ? Math.max(0, 100 - ultraPct - maficPct) : 0;

    const r = 36;
    const c = 2 * Math.PI * r;
    const uLen = (ultraPct / 100) * c;
    const mLen = (maficPct / 100) * c;
    const oLen = (otherPct / 100) * c;
    
    const uOffset = 0;
    const mOffset = -uLen;
    const oOffset = -(uLen + mLen);

    html += `
      <div class="ml-insights-row">
        <!-- AI Verdict -->
        <div class="ml-verdict ${verdictClass}">
          <span class="verdict-icon">${verdictIcon}</span>
          <div class="verdict-text">
            <h3>${verdictTitle}</h3>
            <p>${verdictDesc}</p>
          </div>
        </div>

        <!-- Lithology Donut Chart -->
        <div class="lith-donut-card">
          <div class="lith-donut-header">
            <span class="lith-donut-title">Komposisi Litologi</span>
            <span class="lith-donut-badge">${ultraPct}% Ultramafik</span>
          </div>
          <div class="lith-donut-body">
            <div class="lith-donut-chart-wrap">
              <svg viewBox="0 0 100 100" class="lith-donut-svg">
                <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="13" />
                ${otherPct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="13" stroke-dasharray="${oLen.toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${oOffset.toFixed(2)}" transform="rotate(-90 50 50)" />` : ''}
                ${maficPct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#0ea5e9" stroke-width="13" stroke-dasharray="${mLen.toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${mOffset.toFixed(2)}" transform="rotate(-90 50 50)" />` : ''}
                ${ultraPct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#10b981" stroke-width="13" stroke-dasharray="${uLen.toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${uOffset.toFixed(2)}" transform="rotate(-90 50 50)" />` : ''}
                <text x="50" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="#ffffff">${ultraPct}%</text>
                <text x="50" y="59" text-anchor="middle" font-size="7.5" font-weight="600" fill="#10b981" letter-spacing="0.04em">ULTRAMAFIK</text>
              </svg>
            </div>
            <div class="lith-donut-legend">
              <div class="lith-donut-legend-item">
                <span class="lith-legend-dot ultra"></span>
                <div class="lith-legend-text">
                  <span class="lith-legend-name">Serpentinite / Ultramafik</span>
                  <b class="lith-legend-pct text-emerald">${ultraPct}%</b>
                </div>
              </div>
              <div class="lith-donut-legend-item">
                <span class="lith-legend-dot mafic"></span>
                <div class="lith-legend-text">
                  <span class="lith-legend-name">Mafic / Basalt</span>
                  <b class="lith-legend-pct text-sky">${maficPct}%</b>
                </div>
              </div>
              <div class="lith-donut-legend-item">
                <span class="lith-legend-dot other"></span>
                <div class="lith-legend-text">
                  <span class="lith-legend-name">Sedimen / Lainnya</span>
                  <b class="lith-legend-pct text-muted">${otherPct}%</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 2. Pros & Cons (Faktor Pendukung / Pembatas)
    // Calculate simple stats to generate text points
    const lithCounts = {};
    scored.forEach(c => { const l = (c.lith || 'unknown').replace('_simulated', ''); lithCounts[l] = (lithCounts[l] || 0) + 1; });
    const lithEntries = Object.entries(lithCounts).sort((a, b) => b[1] - a[1]);
    const dominantLith = lithEntries[0]?.[0] || 'unknown';
    const dominantPct = total ? Math.round(lithEntries[0]?.[1] / total * 100) : 0;
    const isUltraDominant = ['serpentinite', 'peridotite', 'ultramafic'].some(k => dominantLith.includes(k));
    
    const steepCount = scored.filter(c => c.slope > 15).length;
    const nogoCount = scored.filter(c => c.legal === 'no-go').length;
    const farRoadCount = scored.filter(c => c.road > 2000).length;

    const pros = [];
    const cons = [];

    if (isUltraDominant) pros.push(`Didominasi litologi ultramafik prospektif (${dominantLith}: ${dominantPct}%)`);
    else cons.push(`Litologi dominan bukan ultramafik (${dominantLith}: ${dominantPct}%)`);

    if (nogoCount === 0) pros.push(`100% area bebas dari hutan lindung (Status Clean)`);
    else cons.push(`${Math.round(nogoCount/total*100)}% area berada di zona Hutan Lindung (No-Go)`);

    if (steepCount === 0) pros.push(`Topografi sangat ideal, kemiringan landai`);
    else if (steepCount > total * 0.3) cons.push(`Terdapat area dengan lereng curam >15° (${Math.round(steepCount/total*100)}%)`);

    if (farRoadCount === 0) pros.push(`Aksesibilitas sangat baik (<2km dari jalan raya)`);
    else if (farRoadCount > total * 0.5) cons.push(`Aksesibilitas minim, sebagian besar grid jauh dari jalan`);

    if (pros.length === 0) pros.push("Tidak ada faktor pendukung yang dominan.");
    if (cons.length === 0) cons.push("Tidak ada faktor penghambat signifikan.");

    html += `
      <div class="pros-cons-grid">
        <div class="pros-cons-card pros">
          <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Faktor Pendukung</h4>
          <ul class="pros-cons-list">
            ${pros.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>
        <div class="pros-cons-card cons">
          <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Faktor Pembatas</h4>
          <ul class="pros-cons-list">
            ${cons.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    // 3. Top Drone Targets (Cards)
    html += '<div class="ml-section-title">Rekomendasi Titik Survei Utama (Top Targets)</div>';
    html += '<div class="target-cards-list">';
    
    const topTargets = sorted.slice(0, 3).filter(c => c.score > 0);
    
    if (topTargets.length === 0) {
      html += `<div style="text-align:center;padding:24px;border:1px dashed var(--border-subtle);border-radius:var(--radius-md);color:var(--text-secondary);font-size:12px;">Tidak ada target potensial yang valid di area ini.</div>`;
    } else {
      topTargets.forEach((c, i) => {
        const lithText = (c.lith || 'unknown').replace('_simulated', '');
        const legalText = c.legal === 'no-go' ? 'Terlarang (No-Go)' : c.legal === 'conditional' ? 'Bersyarat' : 'Diizinkan';
        
        let targetDesc = `Litologi: <b>${lithText}</b> | Kemiringan: <b>${c.slope}°</b> | Legal: <b>${legalText}</b>`;
        
        html += `
          <div class="target-card">
            <div class="target-rank">#${i + 1}</div>
            <div class="target-info">
              <div class="target-id">${c.gid} <span class="target-score">Skor ${c.score.toFixed(1)}/10</span></div>
              <div class="target-desc">${targetDesc}</div>
            </div>
          </div>
        `;
      });
    }
    
    html += '</div>';

    container.innerHTML = html;
  }

  // ----- Export -----
  function showExportTable() {
    const getScore = (id) => {
      const r = mlResults ? mlResults[id] : null;
      if (!r || r.ml_score == null) return 0;
      return r.ml_masked ? 0 : r.ml_score;
    };

    const cells = currentGrid.cells.map(c => {
      const ultra = c.lith && c.lith.includes('ultra');
      const slopeScore = c.slope > 5 && c.slope < 15 ? 100 : c.slope <= 5 ? 50 : 20;
      const lithScore = ultra ? 100 : c.lith.includes('mafic') ? 50 : 10;
      const sc = getScore(c.gid);
      const priority = Math.round((sc * 10 + slopeScore * 0.4 + lithScore * 0.3));
      return { ...c, priority, score: sc, stars: priority >= 60 ? '**' : priority >= 30 ? '*' : '' };
    }).sort((a, b) => b.priority - a.priority).slice(0, 20);

    const tbody = $('exportBody');
    tbody.innerHTML = '';
    cells.forEach((c, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${c.gid} <span class="star">${c.stars}</span></td>
        <td>${c.priority}</td>
        <td>${c.latC}</td>
        <td>${c.lonC}</td>
        <td>${c.score.toFixed(2)}</td>
        <td>${c.slope}</td>
        <td>${c.lith.replace('_simulated', '')}</td>
      `;
      tbody.appendChild(tr);
    });

    $('btnExportCsv').onclick = () => {
      const header = 'rank,grid_id,priority,latitude,longitude,ml_score,slope_deg,lithology\n';
      const rows = cells.map((c, i) =>
        `${i + 1},${c.gid},${c.priority},${c.latC},${c.lonC},${c.score.toFixed(4)},${c.slope},${c.lith}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `drone_survey_targets_${currentParams.id || 'custom'}.csv`;
      a.click();
    };
  }

  // ----- Tab switching -----
  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab' + name.charAt(0).toUpperCase() + name.slice(1)));
    if (name === 'terrain3d') {
      var hasMlNow = mlResults && Object.keys(mlResults).length > 0;
      if (!_3dRendered || (hasMlNow && !_3dRenderedWithMl)) {
        showTerrain3D();
        _3dRendered = true;
        if (hasMlNow) _3dRenderedWithMl = true;
      }
    }
    if (name === 'mlpred') {
      showMlMap();
    }
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ----- Expand / Collapse -----
  function updateExpandBtn() {
    const panel = $('targetPanel');
    const isExpanded = panel.classList.contains('expanded');
    $('expandIcon').textContent = isExpanded ? '▼' : '▲';
    const label = $('btnExpand').querySelector('.expand-label');
    if (label) label.textContent = isExpanded ? 'Collapse' : 'Expand';
  }

  $('btnExpand').addEventListener('click', () => {
    const panel = $('targetPanel');
    if (!panel.classList.contains('open')) return;
    panel.classList.toggle('expanded');
    updateExpandBtn();
    // Invalidate map size after transition
    setTimeout(() => map.invalidateSize(), 450);
  });

  // Wireframe toggle
  $('btnWireframe').addEventListener('click', function() {
    if (_3dMesh && _3dMesh.material) {
      _3dMesh.material.wireframe = !_3dMesh.material.wireframe;
      this.textContent = _3dMesh.material.wireframe ? 'Solid' : 'Wireframe';
    }
  });

  // Drag handle: click toggles between open ↔ expanded
  $('panelHandle').addEventListener('click', () => {
    const panel = $('targetPanel');
    if (!panel.classList.contains('open')) return;
    panel.classList.toggle('expanded');
    updateExpandBtn();
    setTimeout(() => map.invalidateSize(), 450);
  });

  // ----- Init -----
  initMap();
});
