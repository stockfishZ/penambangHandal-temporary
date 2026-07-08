// Client-side 20×20 study grid generator
// Generates grid geometry with synthetic observable features for ML inference.
// NO hidden truth (true_ni_pct) is exposed — all values are features the ML model can see.

const CELL_SIZE_MAP = {
  FLAT: 0.005, ROLLING: 0.008, HILLY: 0.010, MOUNTAINOUS: 0.012
};

const LITHOLOGIES = [
  'serpentinite_simulated', 'peridotite_simulated', 'ultramafic_simulated',
  'mafic_volcanic_simulated', 'alluvium'
];

const TIER_WEIGHTS = {
  HIGH: [0.35, 0.25, 0.20, 0.12, 0.08],
  MEDIUM: [0.20, 0.20, 0.15, 0.25, 0.20],
  LOW: [0.10, 0.10, 0.10, 0.30, 0.40]
};

const LEGAL_FALLBACK = ['allowed', 'allowed', 'allowed', 'conditional', 'no-go'];

const FOREST_TYPE_TO_LEGAL = {
  'Hutan Lindung': 'no-go',
  'Hutan Produksi': 'conditional',
  'Areal Penggunaan Lain': 'allowed',
};

// Seeded random (mulberry32) for reproducibility
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function weightedRandom(rng, items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
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

function cellLegalStatus(lonC, latC, forestryData) {
  if (!forestryData) return LEGAL_FALLBACK[Math.floor(Math.random() * LEGAL_FALLBACK.length)];
  for (const feat of forestryData.features) {
    const coords = feat.geometry.coordinates;
    for (const ring of coords) {
      if (pointInPolygon(lonC, latC, ring)) {
        return FOREST_TYPE_TO_LEGAL[feat.properties.type] || 'unknown';
      }
    }
  }
  return LEGAL_FALLBACK[Math.floor(Math.random() * LEGAL_FALLBACK.length)];
}

function generateGrid(bbox, params, forestryData) {
  const rng = mulberry32(42);
  const NX = 20, NY = 20;
  const terrain = params.terrain_class || 'ROLLING';
  const tier = params.tier || 'LOW';
  const cellDeg = CELL_SIZE_MAP[terrain] || 0.008;
  const lithWeights = TIER_WEIGHTS[tier] || TIER_WEIGHTS.LOW;
  const slopeMean = params.slope_mean || 10;

  const lonMin = bbox[0], latMin = bbox[1];
  const lonMax = bbox[2], latMax = bbox[3];
  const cellW = (lonMax - lonMin) / NX;
  const cellH = (latMax - latMin) / NY;
  const clon = (lonMin + lonMax) / 2;
  const clat = (latMin + latMax) / 2;
  const halfExtent = (lonMax - lonMin) / 2;
  const spatialScale = halfExtent * 0.8;
  const prefix = (params.prefix || 'GEN').toUpperCase();

  const cells = [];
  for (let row = 0; row < NY; row++) {
    for (let col = 0; col < NX; col++) {
      const idx = row * NX + col;
      const gid = `${prefix}${(idx + 1).toString().padStart(3, '0')}`;
      const lon0 = lonMin + col * cellW;
      const lat0 = latMin + row * cellH;
      const lonC = lon0 + cellW / 2;
      const latC = lat0 + cellH / 2;

      const lith = weightedRandom(rng, LITHOLOGIES, lithWeights);
      const legal = cellLegalStatus(lonC, latC, forestryData);
      const slope = Math.round((Math.random() * (slopeMean + 8 - Math.max(1, slopeMean - 5)) + Math.max(1, slopeMean - 5)) * 10) / 10;
      const river = Math.round(Math.random() * (1200 - 80) + 80);
      const road = Math.round(Math.random() * (3500 - 300) + 300);

      const dLon = (lonC - clon) / spatialScale;
      const dLat = (latC - clat) / spatialScale;
      const distFactor = 0.5 + 0.5 * Math.exp(-Math.sqrt(dLon * dLon + dLat * dLat));
      const smelterKm = Math.round((10 + Math.sqrt(dLon * dLon + dLat * dLat) * 40) * 10) / 10;
      const area = Math.round(cellDeg * cellDeg * 111 * 111 * 100) / 100;

      const regionId = `${latC >= clat ? 'N' : 'S'}${lonC >= clon ? 'E' : 'W'}`;

      cells.push({
        gid, lonC: Math.round(lonC * 100000) / 100000,
        latC: Math.round(latC * 100000) / 100000,
        lon0: Math.round(lon0 * 100000) / 100000,
        lat0: Math.round(lat0 * 100000) / 100000,
        cellW, cellH,
        lith, legal, slope, river, road,
        smelter: smelterKm, area, regionId,
      });
    }
  }

  // Build GeoJSON
  const features = cells.map(c => ({
    type: 'Feature',
    properties: {
      grid_id: c.gid,
      site: params.id || 'custom',
      location_label: `${params.name || 'Custom Area'} nickel laterite`,
      lithology: c.lith,
      slope_deg: c.slope,
      distance_to_river_m: c.river,
      distance_to_road_m: c.road,
      legal_status: c.legal,
      distance_to_smelter_km: c.smelter,
      area_ha: c.area,
      region_id: c.regionId
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [c.lon0, c.lat0],
        [Math.round((c.lon0 + c.cellW) * 100000) / 100000, c.lat0],
        [Math.round((c.lon0 + c.cellW) * 100000) / 100000, Math.round((c.lat0 + c.cellH) * 100000) / 100000],
        [c.lon0, Math.round((c.lat0 + c.cellH) * 100000) / 100000],
        [c.lon0, c.lat0]
      ]]
    }
  }));

  return {
    type: 'FeatureCollection',
    features,
    cells
  };
}
