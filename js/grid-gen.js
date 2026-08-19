// Client-side 20×20 study grid generator
// Generates grid geometry with synthetic observable features for ML inference.
// NO hidden truth (true_ni_pct) is exposed — all values are features the ML model can see.

const CELL_SIZE_MAP = {
  FLAT: 0.005, ROLLING: 0.008, HILLY: 0.010, MOUNTAINOUS: 0.012
};

const LITHOLOGIES = [
  'serpentinite_simulated', 'peridotite_simulated', 'harzburgite_simulated',
  'dunite_simulated', 'ultramafic_simulated', 'lherzolite_simulated',
  'pyroxenite_simulated', 'mafic_volcanic_simulated', 'gabbro_simulated',
  'basalt_simulated', 'alluvium'
];

const TIER_WEIGHTS = {
  HIGH: [0.20, 0.15, 0.13, 0.11, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.02],
  MEDIUM: [0.14, 0.12, 0.11, 0.10, 0.09, 0.08, 0.08, 0.07, 0.07, 0.07, 0.07],
  LOW: [0.08, 0.07, 0.06, 0.06, 0.06, 0.06, 0.06, 0.10, 0.10, 0.12, 0.23]
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

function pointInPolygon(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function cellInAnyPolygon(lonC, latC, coordArrays) {
  if (!coordArrays || coordArrays.length === 0) return false;
  if (!pointInPolygon(lonC, latC, coordArrays[0])) return false;
  for (let i = 1; i < coordArrays.length; i++) {
    if (pointInPolygon(lonC, latC, coordArrays[i])) return false;
  }
  return true;
}

function cellLegalStatus(lonC, latC, forestryData) {
  if (!forestryData) return 'allowed';
  for (const feat of forestryData.features) {
    const g = feat.geometry;
    const props = feat.properties;
    const status = props.legal_status || props.type || 'allowed';
    if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        if (cellInAnyPolygon(lonC, latC, poly)) return status;
      }
    } else {
      if (cellInAnyPolygon(lonC, latC, g.coordinates)) return status;
    }
  }
  return 'allowed';
}

// Verified Indonesian Nickel Smelters & Industrial Parks
const INDONESIA_SMELTERS = [
  { id: 'pomalaa', name: 'PT ANTAM Pomalaa', lat: -4.180, lon: 121.600 },
  { id: 'halmahera_timur', name: 'PT ANTAM Haltim', lat: 0.880, lon: 128.320 },
  { id: 'sorowako', name: 'PT Vale Sorowako', lat: -2.533, lon: 121.350 },
  { id: 'imip', name: 'IMIP Morowali', lat: -2.825, lon: 122.158 },
  { id: 'gni', name: 'PT GNI Morowali Utara', lat: -1.975, lon: 121.340 },
  { id: 'konawe', name: 'VDNI & OSS Konawe', lat: -3.880, lon: 122.430 },
  { id: 'cni', name: 'PT Ceria Wolo (Kolaka)', lat: -3.890, lon: 121.280 },
  { id: 'stargate', name: 'PT Stargate Konawe Utara', lat: -3.320, lon: 122.250 },
  { id: 'wedabay', name: 'IWIP Weda Bay', lat: 0.485, lon: 127.915 },
  { id: 'harita_obi', name: 'Harita Pulau Obi', lat: -1.545, lon: 127.575 },
  { id: 'wanatiara', name: 'PT Wanatiara Obi', lat: -1.510, lon: 127.630 },
  { id: 'bantaeng', name: 'Huadi Bantaeng', lat: -5.550, lon: 120.020 }
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceToNearestSmelter(lat, lon) {
  let minD = Infinity;
  for (const s of INDONESIA_SMELTERS) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < minD) minD = d;
  }
  return minD;
}

function generateGrid(bbox, params, forestryData) {
  // Derive a unique deterministic seed from bounding box coordinates
  const seedString = `${bbox[0].toFixed(4)}_${bbox[1].toFixed(4)}_${bbox[2].toFixed(4)}_${bbox[3].toFixed(4)}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0;
  }
  const rng = mulberry32(Math.abs(hash) || 42);

  const NX = 20, NY = 20;
  const terrain = params.terrain_class || 'ROLLING';
  const tier = params.tier || 'LOW';
  const lithWeights = TIER_WEIGHTS[tier] || TIER_WEIGHTS.LOW;
  const slopeMean = params.slope_mean || 10;

  const lonMin = bbox[0], latMin = bbox[1];
  const lonMax = bbox[2], latMax = bbox[3];
  const cellW = (lonMax - lonMin) / NX;
  const cellH = (latMax - latMin) / NY;
  const clon = (lonMin + lonMax) / 2;
  const clat = (latMin + latMax) / 2;
  const prefix = (params.prefix || 'GEN').toUpperCase();

  // Compute real dynamic area in hectares for each cell based on geographic extent
  const widthKm = Math.abs(lonMax - lonMin) * 111.32 * Math.cos(clat * Math.PI / 180);
  const heightKm = Math.abs(latMax - latMin) * 110.57;
  const cellAreaHa = Math.max(0.01, Math.round(((widthKm / NX) * (heightKm / NY) * 100) * 100) / 100);

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
      const slope = Math.round((rng() * (slopeMean + 8 - Math.max(1, slopeMean - 5)) + Math.max(1, slopeMean - 5)) * 10) / 10;
      const river = Math.round(rng() * (1200 - 80) + 80);
      const road = Math.round(rng() * (3500 - 300) + 300);

      // Real distance to nearest smelter + local perturbation
      const baseSmelterKm = getDistanceToNearestSmelter(latC, lonC);
      const localSmelterVar = (rng() - 0.5) * 4;
      const smelterKm = Math.max(1, Math.round((baseSmelterKm + localSmelterVar) * 10) / 10);

      const regionId = `${latC >= clat ? 'N' : 'S'}${lonC >= clon ? 'E' : 'W'}`;

      cells.push({
        gid, lonC: Math.round(lonC * 100000) / 100000,
        latC: Math.round(latC * 100000) / 100000,
        lon0: Math.round(lon0 * 100000) / 100000,
        lat0: Math.round(lat0 * 100000) / 100000,
        cellW, cellH,
        lith, legal, slope, river, road,
        smelter: smelterKm, area: cellAreaHa, regionId,
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
