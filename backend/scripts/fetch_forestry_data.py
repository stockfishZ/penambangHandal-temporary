"""Fetch real forestry boundary data from BIG Satupeta ArcGIS REST API.

Source: https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer
Layer: 0 — Penetapan Kawasan Hutan (Forest Area Designation)
Field: fungsitap — forest function code
  - 100100 (HSA) → no-go
  - 100200-100260 (HL) → no-go  
  - 100300 (HPT) → conditional
  - 100400 (HP) → conditional  
  - 100500 (HPK) → conditional

Strategy:
  - Non-Sulawesi belts: point-based query at known site coordinates (original approach)
  - Sulawesi belts: tiled scan (0.3° × 0.3°) across full belt polygon extents,
    pre-filtered by belt polygon intersection

Overwrites: data/forestry_boundaries.geojson
"""
import json, os, sys, urllib.request, time, math

API_BASE = 'https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer/0/query'

FUNGSITAP_MAP = {
    '100100': 'no-go', '100200': 'no-go', '100210': 'no-go',
    '100220': 'no-go', '100230': 'no-go', '100240': 'no-go', '100250': 'no-go',
    '100260': 'no-go', '100300': 'conditional', '100400': 'conditional',
    '100500': 'conditional',
}

# Original point-based sites (non-Sulawesi + legacy)
SITES = [
    {"id":"sorowako","lon":121.35,"lat":-2.53,"terrain":"HILLY"},
    {"id":"morowali","lon":122.16,"lat":-2.83,"terrain":"ROLLING"},
    {"id":"weda_bay","lon":128.05,"lat":0.52,"terrain":"MOUNTAINOUS"},
    {"id":"pomalaa","lon":121.63,"lat":-4.20,"terrain":"FLAT"},
    {"id":"gag_island","lon":129.88,"lat":-0.07,"terrain":"ROLLING"},
    {"id":"obi_island","lon":127.72,"lat":-1.50,"terrain":"MOUNTAINOUS"},
    {"id":"konawe","lon":122.42,"lat":-3.91,"terrain":"HILLY"},
    {"id":"tapunopaka","lon":122.18,"lat":-3.61,"terrain":"FLAT"},
]

# Sulawesi belt names to tile-scan
SULAWESI_BELTS = [
    "East Sulawesi Ophiolite Belt",
    "Southeast Sulawesi Nickel District",
]

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'forestry_boundaries.geojson')
BELTS_PATH = os.path.join(DATA_DIR, 'indonesia_nickel_belts.geojson')

TILE_DEG = 0.3
API_DELAY = 0.5


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def point_in_polygon(lon, lat, ring):
    inside = False
    for i in range(len(ring)):
        j = i - 1
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat) and
            lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi):
            inside = not inside
    return inside


def point_in_belt(lon, lat, belt_features):
    for f in belt_features:
        g = f['geometry']
        coords = g['coordinates']
        if g['type'] == 'MultiPolygon':
            for poly in coords:
                if point_in_polygon(lon, lat, poly[0]):
                    return True
        else:
            if point_in_polygon(lon, lat, coords[0]):
                return True
    return False


def _tag_belt_features(features):
    """Assign 'site' property to belt_scan features by centroid proximity to known sites."""
    half = 0.15
    site_boxes = [{'id': s['id'], 'xmin': s['lon'] - half, 'xmax': s['lon'] + half,
                   'ymin': s['lat'] - half, 'ymax': s['lat'] + half} for s in SITES]
    tagged = 0
    for f in features:
        props = f.get('properties', {})
        if props.get('site'):
            continue
        g = f['geometry']
        coords = g['coordinates']
        ring = coords[0][0] if g['type'] == 'MultiPolygon' else coords[0]
        clon = sum(p[0] for p in ring) / len(ring)
        clat = sum(p[1] for p in ring) / len(ring)
        for sb in site_boxes:
            if sb['xmin'] <= clon <= sb['xmax'] and sb['ymin'] <= clat <= sb['ymax']:
                props['site'] = sb['id']
                tagged += 1
                break
        else:
            props['site'] = 'sulawesi_belt'
    print(f"  Tagged {tagged} belt_scan features with site names")


def load_belt_polygons(path):
    with open(path) as f:
        fc = json.load(f)
    belt_features = [ft for ft in fc['features']
                     if ft['properties'].get('name') in SULAWESI_BELTS]
    print(f"Loaded {len(belt_features)} Sulawesi belt polygon(s):")
    for bf in belt_features:
        print(f"  - {bf['properties']['name']}")
    return belt_features


# ---------------------------------------------------------------------------
# API query
# ---------------------------------------------------------------------------

def query_envelope(xmin, ymin, xmax, ymax):
    geom = f'{xmin},{ymin},{xmax},{ymax}'
    url = (f'{API_BASE}?where=1%3D1'
           f'&geometry={geom}'
           f'&geometryType=esriGeometryEnvelope&inSR=4326'
           f'&outFields=objectid,fungsitap,namobj,nosktap'
           f'&returnGeometry=true&f=geoJSON')
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# Belt tiled scan
# ---------------------------------------------------------------------------

def tile_belt(belt_feat, belt_features):
    """Scan a belt polygon with 0.3° tiles and collect forestry features."""
    g = belt_feat['geometry']
    coords = g['coordinates']
    if g['type'] == 'MultiPolygon':
        ring = coords[0][0]
    else:
        ring = coords[0]

    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    xmin, xmax = min(lons), max(lons)
    ymin, ymax = min(lats), max(lats)

    name = belt_feat['properties']['name']
    cols = int(math.ceil((xmax - xmin) / TILE_DEG))
    rows = int(math.ceil((ymax - ymin) / TILE_DEG))
    total = cols * rows
    print(f"\nTiling '{name}' — {cols}×{rows} = {total} tiles ({TILE_DEG}°)")

    features = []
    errors = []
    tile_idx = 0
    for r in range(rows):
        y0 = ymin + r * TILE_DEG
        y1 = min(y0 + TILE_DEG, ymax)
        for c in range(cols):
            x0 = xmin + c * TILE_DEG
            x1 = min(x0 + TILE_DEG, xmax)
            tile_idx += 1

            # Pre-filter: skip tile if center is outside all Sulawesi belts
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            if not point_in_belt(cx, cy, belt_features):
                continue

            try:
                data = query_envelope(x0, y0, x1, y1)
                feats = data.get('features', [])
                if feats:
                    for f in feats:
                        f['properties']['tile_source'] = 'belt_scan'
                    features.extend(feats)
                    print(f"  [{tile_idx}/{total}] ({x0:.2f},{y0:.2f}-{x1:.2f},{y1:.2f}) -> {len(feats)} features")
                else:
                    print(f"  [{tile_idx}/{total}] ({x0:.2f},{y0:.2f}) -> 0 (skip)", end='')
                    print(' ' * 10, end='\r')
            except Exception as e:
                errors.append(f"tile ({x0:.2f},{y0:.2f}-{x1:.2f},{y1:.2f}): {e}")
                print(f"\n  [{tile_idx}/{total}] ERROR: {e}")

            time.sleep(API_DELAY)

    return features, errors


# ---------------------------------------------------------------------------
# Point-based site query (kept for legacy sites, mainly non-Sulawesi)
# ---------------------------------------------------------------------------

CELL_SIZE = {
    "FLAT": 0.005, "ROLLING": 0.008, "HILLY": 0.010, "MOUNTAINOUS": 0.012
}
NX, NY = 20, 20
BUFFER = 0.02


def query_site(site):
    sid = site['id']
    clon, clat = site['lon'], site['lat']
    cell_deg = CELL_SIZE.get(site['terrain'], 0.008)
    half = NX * cell_deg / 2
    xmin = round(clon - half - BUFFER, 4)
    ymin = round(clat - half - BUFFER, 4)
    xmax = round(clon + half + BUFFER, 4)
    ymax = round(clat + half + BUFFER, 4)

    data = query_envelope(xmin, ymin, xmax, ymax)
    feats = data.get('features', [])
    print(f"  Querying {sid} ({xmin},{ymin},{xmax},{ymax})... {len(feats)} features")

    for f in feats:
        props = f.get('properties', {})
        props['site'] = sid
        props['tile_source'] = 'point_site'
        code = props.get('fungsitap', '')
        props['legal_status'] = FUNGSITAP_MAP.get(code, 'conditional')

    return feats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    belt_features = load_belt_polygons(BELTS_PATH)
    all_features = []
    all_errors = []

    # --- Phase 1: Tiled belt scan for Sulawesi ---
    print("\n=== Phase 1: Tiled scan of Sulawesi belt polygons ===")
    for bf in belt_features:
        feats, errs = tile_belt(bf, belt_features)
        all_features.extend(feats)
        all_errors.extend(errs)

    # --- Phase 2: Point-based queries for known sites ---
    print("\n=== Phase 2: Point-based site queries ===")
    for site in SITES:
        try:
            feats = query_site(site)
            all_features.extend(feats)
            time.sleep(API_DELAY)
        except Exception as e:
            all_errors.append(f'site {site["id"]}: {e}')
            print(f'  ERROR: {site["id"]}: {e}')

    # --- Deduplicate by objectid ---
    seen = set()
    deduped = []
    for f in all_features:
        oid = f.get('properties', {}).get('objectid')
        if oid and oid not in seen:
            seen.add(oid)
            # Assign legal_status from fungsitap
            props = f.get('properties', {})
            code = props.get('fungsitap', '')
            props['legal_status'] = FUNGSITAP_MAP.get(code, 'conditional')
            deduped.append(f)

    # --- Tag belt_scan features with nearest site name ---
    _tag_belt_features(deduped)

    # --- Write output ---
    fc = {
        "type": "FeatureCollection",
        "features": deduped,
        "metadata": {
            "source": "BIG Satupeta — Penetapan Kawasan Hutan (MapServer/0)",
            "url": API_BASE,
            "date_fetched": time.strftime('%Y-%m-%d'),
            "tile_deg": TILE_DEG,
            "belts_scanned": SULAWESI_BELTS,
            "sites_queried": [s['id'] for s in SITES],
            "feature_count": len(deduped),
            "errors": all_errors if all_errors else "none",
        }
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(fc, f, indent=2)

    # Summary
    status_counts = {}
    for f in deduped:
        s = f['properties'].get('legal_status', 'unknown')
        status_counts[s] = status_counts.get(s, 0) + 1

    print(f'\n{"="*50}')
    print(f'Wrote {len(deduped)} features to {OUT_PATH}')
    print(f'Status breakdown: {json.dumps(status_counts)}')
    if all_errors:
        print(f'Errors ({len(all_errors)}):')
        for e in all_errors:
            print(f'  {e}')


if __name__ == '__main__':
    main()
