// ponytail: ultra — single-page exploration with real backend ML inference
document.addEventListener('DOMContentLoaded', () => {
  const NICKEL_BELTS_URL = 'data/indonesia_nickel_belts.geojson';
  const API_BASE = '';
  const $ = id => document.getElementById(id);
  const sites = window.NICKEL_SITES.features;

  let map, drawnItems, drawControl, activeDrawHandler;
  let currentBbox = null, currentGrid = null, currentParams = null;
  let gridLayer = null, gridMlLayer = null;
  let beltLayer = null, beltPolygons = null, forestryLayer = null, forestryData = null;
  let _3dRendered = false, _drawingActive = false;
  let mlResults = null, mlLoading = false, mlError = null;

  const tierColor = t => t === 'HIGH' ? '#9FD8BD' : t === 'MEDIUM' ? '#E2A356' : '#ef4444';
  const tierLabel = t => t === 'HIGH' ? 'High' : t === 'MEDIUM' ? 'Medium' : 'Low';
  const scoreColor = s => s >= 75 ? 'green' : s >= 50 ? 'yellow' : 'red';

  function initMap() {
    map = L.map('exploreMap').setView([-2.0, 121.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(map);

    loadNickelBelts();
    loadForestryBoundaries();
    loadMineMarkers();
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
          div.innerHTML = html;
          return div;
        };
        legend.addTo(map);
      });
  }

  function loadMineMarkers() {
    sites.forEach(s => {
      const p = s.properties, c = s.geometry.coordinates;
      L.circleMarker([c[1], c[0]], {
        radius: 7, fillColor: tierColor(p.tier), color: '#000', weight: 2, fillOpacity: 0.9
      }).addTo(map)
        .bindPopup(`<b>${p.name}</b><br>${p.province}<br>Tier: ${p.tier}<br>${p.context}`)
        .bindTooltip(p.name, {permanent: true, direction: 'right', offset: [10, 0], className: 'site-label'});
    });
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
      return {
        id: p.id, name: p.name, province: p.province,
        terrain_class: p.terrain_class, tier: p.tier,
        elevation_mean: p.elevation_mean, elevation_max: p.elevation_max,
        elevation_min: p.elevation_min, slope_mean: p.slope_mean,
        inBelt: true, prefix: p.id.slice(0, 3).toUpperCase()
      };
    }
    return {
      id: 'custom', name: 'Custom Area', province: 'Indonesia',
      terrain_class: 'ROLLING', tier: 'LOW',
      elevation_mean: 200, elevation_max: 400, elevation_min: 50,
      slope_mean: 10, inBelt: false, prefix: 'GEN'
    };
  }

  function enterTargetMode(params) {
    $('mapHint').classList.add('hidden');
    $('btnSelect').classList.remove('btn-active');

    const assessment = computeAssessment(currentGrid.cells, params);
    showGrid();
    showAssessment(assessment, params);
    _3dRendered = false;

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
    $('mlExplanation').innerHTML = '';
    drawnItems.clearLayers();
    if (drawControl) { map.removeControl(drawControl); drawControl = null; }
    setupDrawControl();
    _drawingActive = false;
    activeDrawHandler = null;
    _3dRendered = false;
    ['mlTotalCells','mlHighCount','mlMedCount','mlLowCount','mlTopTarget'].forEach(id => $(id).textContent = '-');
    ['compAllowed','compConditional','compNoGo'].forEach(id => $(id).textContent = '-');
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
    $('mlTotalCells').textContent = '...';
    $('mlHighCount').textContent = '...';
    $('mlMedCount').textContent = '...';
    $('mlLowCount').textContent = '...';
    $('mlTopTarget').textContent = 'Loading...';

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

  // ----- Assessment -----
  function computeAssessment(cells, params) {
    const avg = (arr, fn) => { const v = arr.map(fn); return v.reduce((a, b) => a + b, 0) / v.length; };
    const avgSlope = avg(cells, c => c.slope);
    const avgRoad = avg(cells, c => c.road);
    const ultraPct = cells.filter(c => c.lith && c.lith.includes('ultra')).length / cells.length * 100;
    const totalArea = cells.reduce((s, c) => s + (c.area || 0), 0);
    const avgSmelter = avg(cells, c => c.smelter);

    const slopeScore = avgSlope < 8 ? 100 : avgSlope < 15 ? 70 : avgSlope < 20 ? 40 : 10;
    const roadScore = avgRoad < 500 ? 100 : avgRoad < 2000 ? 70 : 30;
    const terrainPenalty = {FLAT: 100, ROLLING: 80, HILLY: 50, MOUNTAINOUS: 20}[params.terrain_class] || 50;
    const safety = Math.round(slopeScore * 0.4 + roadScore * 0.3 + terrainPenalty * 0.3);

    const ultraScore = Math.min(ultraPct, 100);
    const tierScore = {HIGH: 100, MEDIUM: 60, LOW: 20}[params.tier] || 20;
    const beltScore = params.inBelt ? 100 : 30;
    const probable = Math.round(ultraScore * 0.4 + tierScore * 0.3 + beltScore * 0.3);

    const areaScore = totalArea > 500 ? 100 : totalArea > 100 ? 60 : 20;
    const smelterScore = avgSmelter < 50 ? 100 : avgSmelter < 150 ? 60 : 20;
    const worth = Math.round(areaScore * 0.3 + smelterScore * 0.3 + tierScore * 0.4);

    let overall = Math.round(safety * 0.3 + probable * 0.4 + worth * 0.3);
    let recommendation = overall >= 75 ? 'GO' : overall >= 50 ? 'CONDITIONAL' : 'NO-GO';
    if (!params.inBelt) { overall = 0; recommendation = 'NO-GO'; }

    return { safety, probable, worth, overall, recommendation, avgSlope, avgRoad, ultraPct, totalArea, avgSmelter };
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
      $('complianceRow').querySelectorAll('span')[2].style.background = 'rgba(239,68,68,0.2)';
    }

    const banner = $('overallBanner');
    const labels = {GO: 'DEPLOY DRONE TEAM (GO)', CONDITIONAL: 'BERSYARAT (CONDITIONAL)', 'NO-GO': 'BATALKAN (NO-GO)'};
    banner.textContent = `REKOMENDASI: ${labels[a.recommendation]}`;
    banner.className = `banner-${a.recommendation.toLowerCase()}`;

    const setScore = (id, val) => { const el = $(id); el.textContent = val; el.className = 'score-big ' + scoreColor(val); };
    setScore('scoreSafety', a.safety);
    setScore('scoreProb', a.probable);
    setScore('scoreWorth', a.worth);

    $('detailSafety').textContent =
      `Slope avg ${a.avgSlope.toFixed(1)} (${a.avgSlope < 8 ? 'gentle' : a.avgSlope < 15 ? 'moderate' : 'steep'}) ` +
      `Road avg ${Math.round(a.avgRoad)}m Terrain: ${params.terrain_class}`;
    $('detailProb').textContent =
      `Ultramafic ${a.ultraPct.toFixed(0)}% Tier: ${params.tier} ${params.inBelt ? 'Inside nickel belt' : 'Outside known belt'}`;
    $('detailWorth').textContent =
      `Area ${a.totalArea.toFixed(0)} ha Smelter ~${a.avgSmelter.toFixed(0)}km Tier: ${params.tier}`;
    $('siteInfo').textContent = params.inBelt
      ? `${params.name}, ${params.province} ${params.terrain_class} terrain ${currentGrid.features.length} grid cells`
      : `Area tidak berada di sabuk nikel tidak ada potensi laterit.`;
  }

  // ----- 3D Terrain -----
  function showTerrain3D(params) {
    const size = 40;
    const zData = [], slopeData = [];
    let optimal = 0;
    for (let i = 0; i < size; i++) {
      const zRow = [];
      for (let j = 0; j < size; j++) {
        const dx = (i - size / 2) / (size / 4);
        const dy = (j - size / 2) / (size / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wave1 = Math.sin(dx * 1.5) * Math.cos(dy * 1.5) * 15;
        const wave2 = Math.sin(dx * 3 + 2) * Math.cos(dy * 3 + 1) * 5;
        const mtn = (params.elevation_max - params.elevation_mean) * Math.max(0, 1 - dist * 0.4);
        zRow.push(Math.max(params.elevation_min, params.elevation_mean + mtn + wave1 + wave2));
      }
      zData.push(zRow);
    }
    for (let i = 0; i < size; i++) {
      const cRow = [];
      for (let j = 0; j < size; j++) {
        let dzdx = 0, dzdy = 0;
        if (i > 0 && i < size - 1) dzdx = (zData[i + 1][j] - zData[i - 1][j]) / 2;
        if (j > 0 && j < size - 1) dzdy = (zData[i][j + 1] - zData[i][j - 1]) / 2;
        const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * (180 / Math.PI);
        cRow.push(slope > 5 && slope < 15 ? 1 : slope >= 15 && slope < 25 ? 0.5 : 0);
        if (slope > 5 && slope < 15) optimal++;
      }
      slopeData.push(cRow);
    }

    Plotly.newPlot('plotly3d', [{
      z: zData, surfacecolor: slopeData, type: 'surface',
      colorscale: [[0, '#0e1525'], [0.5, '#E2A356'], [1, '#f43f5e']],
      showscale: true,
      colorbar: {
        title: 'Potensi Laterit', titleside: 'right',
        tickvals: [0, 0.5, 1], ticktext: ['Rendah', 'Sedang', 'Tinggi'],
        tickfont: { color: '#EEEAE0', size: 10 }, titlefont: { color: '#EEEAE0', size: 12 }
      },
      hovertemplate: 'Elevasi: %{z:.1f} m<br>Potensi: %{surfacecolor:.1f}<extra></extra>'
    }], {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { showgrid: false, zeroline: false, visible: false },
        yaxis: { showgrid: false, zeroline: false, visible: false },
        zaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.1)' },
        camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
      }
    }, { responsive: true, displayModeBar: false });
  }

  // ----- ML Explanation -----
  function showMlMap() {
    if (!currentGrid) return;
    const container = $('mlExplanation');

    if (mlError) {
      $('mlTotalCells').textContent = 'Error';
      $('mlHighCount').textContent = '-';
      $('mlMedCount').textContent = '-';
      $('mlLowCount').textContent = '-';
      $('mlTopTarget').textContent = '-';
      if (gridMlLayer) { map.removeLayer(gridMlLayer); gridMlLayer = null; }
      container.innerHTML = `<div class="ml-verdict low"><span class="verdict-icon">⚠️</span><div class="verdict-text"><h3>ML Analysis Unavailable</h3><p>${mlError}</p></div></div>`;
      return;
    }
    if (!mlResults) {
      $('mlTotalCells').textContent = '...';
      $('mlHighCount').textContent = '...';
      $('mlMedCount').textContent = '...';
      $('mlLowCount').textContent = '...';
      $('mlTopTarget').textContent = 'Loading...';
      container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:20px;">Analyzing grid cells...</p>';
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
    const avgScore = total ? (scored.reduce((s, c) => s + c.score, 0) / total) : 0;

    // Update stat cards
    $('mlTotalCells').textContent = total;
    $('mlHighCount').textContent = high.length + ' (' + (total ? Math.round(high.length / total * 100) : 0) + '%)';
    $('mlMedCount').textContent = med.length + ' (' + (total ? Math.round(med.length / total * 100) : 0) + '%)';
    $('mlLowCount').textContent = low.length + ' (' + (total ? Math.round(low.length / total * 100) : 0) + '%)';
    $('mlTopTarget').textContent = top ? top.gid + ' @ ' + top.score.toFixed(2) : '-';

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

    // ── Build explanation HTML ──
    let html = '';

    // 1. Overall verdict
    const verdictClass = avgScore >= 6.5 ? 'high' : avgScore >= 3.5 ? 'medium' : 'low';
    const verdictIcon = avgScore >= 6.5 ? '✅' : avgScore >= 3.5 ? '⚡' : '❌';
    const verdictTitle = avgScore >= 6.5 ? 'Area Berpotensi Tinggi' : avgScore >= 3.5 ? 'Area Berpotensi Sedang' : 'Area Berpotensi Rendah';
    const verdictDesc = avgScore >= 6.5
      ? `Rata-rata skor ${avgScore.toFixed(1)}/10 — area ini memiliki kombinasi litologi ultramafik, status hukum yang layak, dan indikator geokimia positif. Direkomendasikan untuk survei drone lanjutan.`
      : avgScore >= 3.5
      ? `Rata-rata skor ${avgScore.toFixed(1)}/10 — area ini menunjukkan potensi parsial. Beberapa sel memiliki indikator kuat namun faktor pembatas (status hukum, kemiringan, atau litologi) menurunkan skor keseluruhan.`
      : `Rata-rata skor ${avgScore.toFixed(1)}/10 — area ini memiliki indikator prospektivitas rendah. Litologi dominan bukan ultramafik, atau sebagian besar sel berada di zona hutan lindung.`;
    html += `<div class="ml-verdict ${verdictClass}"><span class="verdict-icon">${verdictIcon}</span><div class="verdict-text"><h3>${verdictTitle}</h3><p>${verdictDesc}</p></div></div>`;

    // 2. Key driving factors (aggregate across all cells)
    const FEATURE_LABELS = {
      'legal_status': 'Status Hukum',
      'lithology': 'Litologi',
      'slope_deg': 'Kemiringan',
      'road_access': 'Akses Jalan',
      'distance_to_road_m': 'Jarak ke Jalan',
      'distance_to_river_m': 'Jarak ke Sungai',
      'distance_to_smelter_km': 'Jarak ke Smelter',
    };
    const factorAgg = {};
    scored.forEach(c => {
      const topFeats = c.result.ml_top_features || [];
      topFeats.forEach(tf => {
        if (!factorAgg[tf.feature]) factorAgg[tf.feature] = { totalImpact: 0, count: 0, importance: tf.importance };
        factorAgg[tf.feature].totalImpact += tf.impact;
        factorAgg[tf.feature].count += 1;
      });
    });
    const factors = Object.entries(factorAgg)
      .map(([k, v]) => ({ feature: k, avgImpact: v.totalImpact / v.count, importance: v.importance }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 6);

    if (factors.length) {
      const maxImpact = Math.max(...factors.map(f => f.avgImpact), 0.01);
      html += '<div class="ml-section-title">Faktor Pendorong Utama</div>';
      html += '<div class="ml-factor-list">';
      factors.forEach(f => {
        const pct = Math.round((f.avgImpact / maxImpact) * 100);
        const color = f.avgImpact >= 2.0 ? '#10b981' : f.avgImpact >= 0.5 ? '#E2A356' : '#ef4444';
        const label = FEATURE_LABELS[f.feature] || f.feature;
        html += `<div class="ml-factor">
          <span class="ml-factor-name">${label}</span>
          <div class="ml-factor-bar-bg"><div class="ml-factor-bar" style="width:${pct}%;background:${color};"></div></div>
          <span class="ml-factor-val">${f.avgImpact.toFixed(2)}</span>
        </div>`;
      });
      html += '</div>';
    }

    // 3. Lithology breakdown
    const lithCounts = {};
    scored.forEach(c => { const l = (c.lith || 'unknown').replace('_simulated', ''); lithCounts[l] = (lithCounts[l] || 0) + 1; });
    const lithEntries = Object.entries(lithCounts).sort((a, b) => b[1] - a[1]);
    const dominantLith = lithEntries[0]?.[0] || 'unknown';
    const dominantPct = total ? Math.round(lithEntries[0]?.[1] / total * 100) : 0;
    const isUltraDominant = ['serpentinite', 'peridotite', 'ultramafic'].some(k => dominantLith.includes(k));

    html += '<div class="ml-section-title">Analisis Litologi</div>';
    html += `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">`;
    if (isUltraDominant) {
      html += `Litologi dominan: <b style="color:#10b981;">${dominantLith}</b> (${dominantPct}%) — batuan ultramafik adalah host utama endapan nikel laterit. Ini merupakan indikator positif kuat.`;
    } else {
      html += `Litologi dominan: <b style="color:#E2A356;">${dominantLith}</b> (${dominantPct}%) — bukan batuan ultramafik, sehingga potensi nikel laterit terbatas.`;
    }
    html += '</p>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    lithEntries.forEach(([l, n]) => {
      const isU = ['serpentinite', 'peridotite', 'ultramafic'].some(k => l.includes(k));
      const bg = isU ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)';
      const bc = isU ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)';
      html += `<span style="font-size:11px;padding:3px 10px;border-radius:4px;background:${bg};border:1px solid ${bc};color:var(--text-primary);">${l}: ${n}</span>`;
    });
    html += '</div>';

    // 4. Top & Bottom cells side by side
    html += '<div class="ml-section-title">Sel Terbaik vs Terburuk</div>';
    html += '<div class="ml-cells-row">';

    // Top 3
    const top3 = sorted.slice(0, 3);
    html += '<div>';
    top3.forEach((c, i) => {
      const topFeats = (c.result.ml_top_features || []).slice(0, 3);
      const reasons = topFeats.map(tf => `${FEATURE_LABELS[tf.feature] || tf.feature}: +${tf.impact.toFixed(2)}`).join(', ');
      html += `<div class="ml-cell-card top-card" style="margin-bottom:6px;">
        <h4 style="color:#10b981;">#${i + 1} ${c.gid}</h4>
        <span class="cell-score" style="color:#10b981;">${c.score.toFixed(2)}</span>
        <div class="cell-reason">${reasons || 'Skor tinggi dari kombinasi faktor positif'}</div>
      </div>`;
    });
    html += '</div>';

    // Bottom 3
    const bottom3 = sorted.slice(-3).reverse();
    html += '<div>';
    bottom3.forEach((c, i) => {
      const r = c.result;
      let reason = '';
      if (r.ml_masked && r.ml_block_reason) {
        reason = r.ml_block_reason;
      } else {
        const negatives = [];
        if (c.legal === 'no-go') negatives.push('Zona hutan lindung (terlarang)');
        else if (c.legal === 'conditional') negatives.push('Zona bersyarat — perlu izin PPKH');
        const l = (c.lith || '');
        if (!['serpentinite', 'peridotite', 'ultramafic'].some(k => l.includes(k))) negatives.push('Litologi bukan ultramafik');
        if (c.slope > 18) negatives.push(`Kemiringan curam (${c.slope}°)`);
        reason = negatives.join('; ') || 'Kombinasi faktor negatif';
      }
      html += `<div class="ml-cell-card bottom-card" style="margin-bottom:6px;">
        <h4 style="color:#ef4444;">#${total - 2 + i} ${c.gid}</h4>
        <span class="cell-score" style="color:#ef4444;">${c.score.toFixed(2)}</span>
        <div class="cell-reason">${reason}</div>
      </div>`;
    });
    html += '</div></div>';

    // 5. Blocked / masked cells
    const blocked = cells.filter(c => c.result.ml_masked);
    if (blocked.length) {
      html += '<div class="ml-section-title">Sel yang Diblokir oleh ML</div>';
      html += '<div class="ml-blocked-list">';
      blocked.slice(0, 10).forEach(c => {
        html += `<div class="ml-blocked-item"><span class="blocked-dot"></span>${c.gid}: ${c.result.ml_block_reason || 'Blocked'}</div>`;
      });
      if (blocked.length > 10) html += `<div class="ml-blocked-item" style="opacity:0.6;">...dan ${blocked.length - 10} sel lainnya</div>`;
      html += '</div>';
    }

    // 6. Methodology note
    html += `<p style="font-size:11px;color:var(--text-secondary);margin-top:var(--sp-md);opacity:0.7;">Skor prospektivitas (0–10) per grid cell menggunakan model XGBoost. Fitur pra-survei: litologi, status hukum, kemiringan lereng, akses jalan, jarak ke smelter. Cocok untuk perencanaan deploy tim drone — tidak memerlukan data geokimia atau magnetometer. Grid berwarna pada peta utama di atas menunjukkan distribusi spasial skor ML.</p>`;

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
    if (name === 'terrain3d' && !_3dRendered && currentParams) {
      showTerrain3D(currentParams);
      _3dRendered = true;
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
