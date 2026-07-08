import json
import os
import random
import math

# Sites from shared-sites.js
SITES = [
    {"id": "sorowako", "lon": 121.35, "lat": -2.55},
    {"id": "morowali", "lon": 121.96, "lat": -2.82},
    {"id": "weda_bay", "lon": 127.95, "lat": 0.47},
    {"id": "pomalaa", "lon": 121.61, "lat": -4.18},
    {"id": "gag_island", "lon": 129.88, "lat": -0.07},
    {"id": "obi_island", "lon": 127.71, "lat": -1.55},
    {"id": "konawe", "lon": 122.11, "lat": -3.83},
    {"id": "tapunopaka", "lon": 122.18, "lat": -3.61}
]

def generate_polygon(center_lon, center_lat, radius_deg, num_points=6):
    points = []
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        r = radius_deg * (0.8 + 0.4 * random.random())
        lon = center_lon + r * math.cos(angle)
        lat = center_lat + r * math.sin(angle)
        points.append([lon, lat])
    points.append(points[0])
    return points

def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'all_sites')
    os.makedirs(out_dir, exist_ok=True)

    geology_features = []
    slope_features = []
    heatmap_features = []
    mpm_features = []

    for site in SITES:
        clon = site['lon']
        clat = site['lat']
        site_id = site['id']

        # 1. Geology
        poly = generate_polygon(clon, clat, 0.05, num_points=8)
        geology_features.append({
            "type": "Feature",
            "properties": {"layer": "geology", "rock_type": "Ultramafic", "site": site_id},
            "geometry": {"type": "Polygon", "coordinates": [poly]}
        })

        # 2. Slope
        for _ in range(3):
            sx = clon + (random.random() - 0.5) * 0.06
            sy = clat + (random.random() - 0.5) * 0.06
            spoly = generate_polygon(sx, sy, 0.015, num_points=5)
            slope_features.append({
                "type": "Feature",
                "properties": {"layer": "slope", "slope_deg": random.randint(5, 15), "site": site_id},
                "geometry": {"type": "Polygon", "coordinates": [spoly]}
            })

        # 3. Remote Sensing
        for _ in range(40):
            lon = clon + (random.random() - 0.5) * 0.08
            lat = clat + (random.random() - 0.5) * 0.08
            dist = ((lon - clon)**2 + (lat - clat)**2)**0.5
            intensity = max(0, 100 - (dist * 1500)) + random.randint(-10, 10)
            heatmap_features.append({
                "type": "Feature",
                "properties": {"layer": "iron_oxide", "intensity": intensity, "site": site_id},
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            })

        # 4. MPM
        for _ in range(2):
            mx = clon + (random.random() - 0.5) * 0.02
            my = clat + (random.random() - 0.5) * 0.02
            mpoly = generate_polygon(mx, my, 0.008)
            mpm_features.append({
                "type": "Feature",
                "properties": {"layer": "mpm", "prospectivity_score": random.randint(85, 99), "site": site_id},
                "geometry": {"type": "Polygon", "coordinates": [mpoly]}
            })

    # Save all
    with open(os.path.join(out_dir, 'geology.geojson'), 'w') as f:
        json.dump({"type": "FeatureCollection", "features": geology_features}, f)
    with open(os.path.join(out_dir, 'slope.geojson'), 'w') as f:
        json.dump({"type": "FeatureCollection", "features": slope_features}, f)
    with open(os.path.join(out_dir, 'remote_sensing.geojson'), 'w') as f:
        json.dump({"type": "FeatureCollection", "features": heatmap_features}, f)
    with open(os.path.join(out_dir, 'mpm.geojson'), 'w') as f:
        json.dump({"type": "FeatureCollection", "features": mpm_features}, f)

    print("Successfully generated regional datasets for all sites.")

if __name__ == '__main__':
    main()
