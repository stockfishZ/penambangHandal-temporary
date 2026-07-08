"""Fetch real forestry boundary data from BIG Satupeta ArcGIS REST API.

Source: https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer
Layer: 0 — Penetapan Kawasan Hutan (Forest Area Designation)
Field: fungsitap — forest function code
  - 100100 (HSA) → no-go
  - 100200-100260 (HL) → no-go  
  - 100300 (HPT) → conditional
  - 100400 (HP) → conditional  
  - 100500 (HPK) → conditional
Supports geoJSON output, max 1000 records per query.

Overwrites: data/forestry_boundaries.geojson
"""
import json, os, sys, urllib.request, time

API_BASE = 'https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer/0/query'

FUNGSITAP_MAP = {
    '100100': 'no-go',
    '100200': 'no-go',
    '100210': 'no-go',
    '100220': 'no-go',
    '100240': 'no-go',
    '100250': 'no-go',
    '100260': 'no-go',
    '100300': 'conditional',
    '100400': 'conditional',
    '100500': 'conditional',
}

SITES = [
    {"id":"sorowako","lon":121.35,"lat":-2.53,"terrain":"HILLY"},
    {"id":"morowali","lon":121.93,"lat":-2.68,"terrain":"ROLLING"},
    {"id":"weda_bay","lon":128.05,"lat":0.52,"terrain":"MOUNTAINOUS"},
    {"id":"pomalaa","lon":121.63,"lat":-4.20,"terrain":"FLAT"},
    {"id":"gag_island","lon":129.88,"lat":-0.07,"terrain":"ROLLING"},
    {"id":"obi_island","lon":127.72,"lat":-1.50,"terrain":"MOUNTAINOUS"},
    {"id":"konawe","lon":122.11,"lat":-3.83,"terrain":"HILLY"},
    {"id":"tapunopaka","lon":122.18,"lat":-3.61,"terrain":"FLAT"},
]

NX, NY = 20, 20

CELL_SIZE = {
    "FLAT": 0.005, "ROLLING": 0.008, "HILLY": 0.010, "MOUNTAINOUS": 0.012
}

BUFFER = 0.02  # extra buffer beyond grid extent

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'forestry_boundaries.geojson')

def query_site(site):
    sid = site['id']
    clon, clat = site['lon'], site['lat']
    cell_deg = CELL_SIZE.get(site['terrain'], 0.008)
    half = NX * cell_deg / 2

    xmin = round(clon - half - BUFFER, 4)
    ymin = round(clat - half - BUFFER, 4)
    xmax = round(clon + half + BUFFER, 4)
    ymax = round(clat + half + BUFFER, 4)

    geom = f'{xmin},{ymin},{xmax},{ymax}'
    url = (f'{API_BASE}?where=1%3D1'
           f'&geometry={geom}'
           f'&geometryType=esriGeometryEnvelope&inSR=4326'
           f'&outFields=objectid,fungsitap,namobj,nosktap'
           f'&returnGeometry=true&f=geoJSON')

    print(f'  Querying {sid} ({xmin},{ymin},{xmax},{ymax})...', end=' ', flush=True)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    feats = data.get('features', [])
    print(f'{len(feats)} features')

    # Add site property to each feature
    for f in feats:
        props = f.get('properties', {})
        props['site'] = sid
        code = props.get('fungsitap', '')
        props['legal_status'] = FUNGSITAP_MAP.get(code, 'conditional')

    return feats

def main():
    all_features = []
    errors = []
    for site in SITES:
        try:
            feats = query_site(site)
            all_features.extend(feats)
            time.sleep(0.5)  # rate limit courtesy
        except Exception as e:
            errors.append((site['id'], str(e)))
            print(f'  ERROR: {site["id"]}: {e}')

    # Deduplicate by objectid (ArcGIS native id)
    seen = set()
    deduped = []
    for f in all_features:
        oid = f.get('properties', {}).get('objectid')
        if oid not in seen:
            seen.add(oid)
            deduped.append(f)
        else:
            # merge site list for existing feature
            for df in deduped:
                if df.get('properties', {}).get('objectid') == oid:
                    existing_sites = df['properties'].get('sites', df['properties'].get('site', ''))
                    new_site = f['properties'].get('site', '')
                    if new_site and new_site not in existing_sites:
                        df['properties']['sites'] = existing_sites + ',' + new_site
                    break

    fc = {
        "type": "FeatureCollection",
        "features": deduped,
        "metadata": {
            "source": "BIG Satupeta — Penetapan Kawasan Hutan (MapServer/0)",
            "url": API_BASE,
            "date_fetched": time.strftime('%Y-%m-%d'),
            "site_count": len(SITES),
            "feature_count": len(deduped),
            "errors": errors,
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

    print(f'\n=== Wrote {len(deduped)} features to {OUT_PATH} ===')
    print(f'Status breakdown: {json.dumps(status_counts)}')
    if errors:
        print(f'Errors ({len(errors)}):')
        for sid, err in errors:
            print(f'  {sid}: {err}')

if __name__ == '__main__':
    main()
