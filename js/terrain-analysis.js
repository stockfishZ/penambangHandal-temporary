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
  let _3dRendered = false, _3dRenderedWithMl = false, _elevationLoading = false, _drawingActive = false;
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
  var _3dAnimFrame = null, _3dResizeObserver = null, _3dCleanups = [];

  function showTerrain3D(_cell) {
    if (!_cell) return;
    const container = document.getElementById("terrain3dContainer");
    if (!container) return;

    // Dispose previous Three.js resources
    if (_3dAnimFrame) { cancelAnimationFrame(_3dAnimFrame); _3dAnimFrame = null; }
    if (_3dResizeObserver) { _3dResizeObserver.disconnect(); _3dResizeObserver = null; }
    _3dCleanups.forEach(function(fn) { fn(); });
    _3dCleanups = [];
    // Remove all children (includes previous renderer DOM element)
    while (container.firstChild) container.removeChild(container.lastChild);

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
    labelDiv.style.cssText = "position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-family:var(--font-ui);font-size:11px;color:rgba(238,234,224,0.5);pointer-events:none;";
    labelDiv.textContent = "Longitude \u2192";
    container.appendChild(labelDiv);
    var labelDiv2 = document.createElement("div");
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
    if (spinner) { spinner.classList.remove("hidden"); spinner.textContent = "Loading elevation from terrain tiles..."; }
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
            if (spinner) spinner.textContent = 'Elevation tiles: ' + loaded + '/' + total;
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
      if (spinner) spinner.classList.add('hidden');
      if (_3dRendered) showTerrain3D(currentParams || currentGrid);
    }

    if (total === 0) finish();
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
    if (name === 'terrain3d') {
      var hasMlNow = mlResults && Object.keys(mlResults).length > 0;
      if (!_3dRendered || (hasMlNow && !_3dRenderedWithMl)) {
        showTerrain3D(currentParams || currentGrid);
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
