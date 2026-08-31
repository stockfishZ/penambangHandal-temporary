import json
import os
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, Point, box
from shapely.ops import unary_union
from shapely.validation import make_valid

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LANDMASS_PATH = os.path.join(DATA_DIR, "indonesia_landmass.geojson")
OUTPUT_BELTS_PATH = os.path.join(DATA_DIR, "indonesia_nickel_belts.geojson")

def round_coords(coords, precision=6):
    if isinstance(coords, (float, int)):
        return round(float(coords), precision)
    elif isinstance(coords, (list, tuple)):
        return [round_coords(c, precision) for c in coords]
    return coords

def clean_poly(geom):
    """Clean geometry to only Polygon or MultiPolygon with area > 1e-6."""
    if geom is None or geom.is_empty:
        return None
    if not geom.is_valid:
        geom = make_valid(geom)
    polys = []
    if geom.geom_type == 'Polygon':
        if geom.area > 1e-6:
            polys.append(geom)
    elif geom.geom_type == 'MultiPolygon':
        for p in geom.geoms:
            if p.area > 1e-6:
                polys.append(p)
    elif geom.geom_type == 'GeometryCollection':
        for g in geom.geoms:
            if g.geom_type == 'Polygon' and g.area > 1e-6:
                polys.append(g)
            elif g.geom_type == 'MultiPolygon':
                for p in g.geoms:
                    if p.area > 1e-6:
                        polys.append(p)
    if not polys:
        return None
    u = unary_union(polys)
    if not u.is_valid:
        u = make_valid(u)
    if u.geom_type == 'Polygon':
        return u
    elif u.geom_type == 'MultiPolygon':
        filtered = [p for p in u.geoms if p.area > 1e-6]
        if len(filtered) == 1:
            return filtered[0]
        return MultiPolygon(filtered)
    return None

def generate_clean_belts():
    # 1. Load landmass
    with open(LANDMASS_PATH, 'r', encoding='utf-8') as f:
        land_fc = json.load(f)

    land_geom = shape(land_fc['features'][0]['geometry'])
    if not land_geom.is_valid:
        land_geom = make_valid(land_geom)

    land_polys = list(land_geom.geoms) if land_geom.geom_type == 'MultiPolygon' else [land_geom]

    def find_land_poly_by_point(lon, lat):
        pt = Point(lon, lat)
        best_poly = None
        min_dist = float('inf')
        for p in land_polys:
            if p.contains(pt):
                return p
            d = p.distance(pt)
            if d < min_dist:
                min_dist = d
                best_poly = p
        if min_dist < 0.05:
            return best_poly
        return None

    # Identify individual islands
    sulawesi_main = find_land_poly_by_point(120.0, -3.0)
    halmahera_main = find_land_poly_by_point(128.0, 0.6)
    obi_main = find_land_poly_by_point(127.7, -1.53)
    bisa_island = find_land_poly_by_point(127.58, -1.22)
    waigeo_main = find_land_poly_by_point(130.8, -0.15)
    gag_island = find_land_poly_by_point(129.875, -0.045)
    gebe_island = find_land_poly_by_point(129.43, -0.09)
    peleng_island = find_land_poly_by_point(123.15, -1.4)
    sanana_island = find_land_poly_by_point(125.98, -2.1)
    mangole_island = find_land_poly_by_point(125.8, -1.85)
    taliabu_island = find_land_poly_by_point(124.8, -1.8)
    sebuku_island = find_land_poly_by_point(116.38, -3.5)
    pulau_laut = find_land_poly_by_point(116.15, -3.6)
    ambon_island = find_land_poly_by_point(128.18, -3.65)
    seram_main = find_land_poly_by_point(129.0, -3.2)
    kabaena_island = find_land_poly_by_point(121.9, -5.28)
    wowoni_island = find_land_poly_by_point(123.1, -4.12)
    kalimantan_main = find_land_poly_by_point(114.0, -1.0)
    papua_main = find_land_poly_by_point(138.0, -4.0)
    sumatra_main = find_land_poly_by_point(100.0, 0.0)
    timor_main = find_land_poly_by_point(124.5, -9.5)
    rote_island = find_land_poly_by_point(123.1, -10.7)

    # 1. Banggai-Sula Archipelago Ultramafic Belt
    banggai_sula_geom = clean_poly(unary_union([peleng_island, sanana_island, mangole_island, taliabu_island]))

    # 2. Waigeo-Gag-Gebe Ophiolite Belt
    waigeo_gag_geom = clean_poly(unary_union([waigeo_main, gag_island, gebe_island]))

    # 3. Obi Island Ophiolite
    obi_geom = clean_poly(unary_union([obi_main, bisa_island]))

    # 4. Halmahera Ophiolite Belt (East Arm, Central Spine, Southeast Arm)
    halmahera_zone = Polygon([
        [127.65, -0.95],
        [128.95, -0.95],
        [128.95, 1.35],
        [128.10, 1.35],
        [127.65, 0.20],
        [127.65, -0.95]
    ])
    halmahera_geom = clean_poly(halmahera_main.intersection(halmahera_zone))

    # 5. Sulbar & Palu-Koro Suture Belt (West Sulawesi along Palu-Koro fault)
    sulbar_zone = Polygon([
        [118.5, -3.5],
        [120.1, -3.5],
        [120.3, -2.0],
        [120.0, -0.8],
        [119.2, -0.8],
        [118.5, -3.5]
    ])
    sulbar_geom = clean_poly(sulawesi_main.intersection(sulbar_zone))

    # 6. East Sulawesi Ophiolite Belt (ESOB)
    # Covers East Arm (Ampana to Luwuk) and Southeast Arm (Sorowako, Morowali, Kolaka, Pomalaa, Konawe, Tapunopaka, Bombana)
    # Plus Kabaena and Wowoni islands
    esob_sulawesi_zone = Polygon([
        [120.2, -5.5],   # South of Kolaka / Bombana
        [123.2, -5.5],   # Southeast Sulawesi Banda Sea
        [123.65, -4.0],
        [123.65, -1.0],  # East Arm Tip (Luwuk)
        [123.65, -0.7],
        [121.2, -0.7],   # Tomini Bay south coast / Ampana
        [120.8, -1.8],   # Kolodale / Morowali Utara junction
        [120.5, -2.4],   # North of Lake Matano / Nuha
        [120.2, -3.8],   # West of Kolaka / Wolo
        [120.2, -5.5]
    ])
    esob_sulawesi_part = sulawesi_main.intersection(esob_sulawesi_zone)
    esob_islands = unary_union([kabaena_island, wowoni_island])
    esob_raw = unary_union([esob_sulawesi_part, esob_islands])
    esob_clean = esob_raw.difference(banggai_sula_geom).difference(sulbar_geom)
    esob_geom = clean_poly(esob_clean)
    # Ensure sulbar is strictly disjoint
    sulbar_geom = clean_poly(sulbar_geom.difference(esob_geom))

    # 7. Meratus & Sebuku Ophiolite Belt (South Kalimantan + Sebuku + Pulau Laut)
    meratus_zone = Polygon([
        [114.8, -4.0],
        [116.3, -4.0],
        [116.3, -2.4],
        [115.0, -2.4],
        [114.8, -4.0]
    ])
    meratus_kalimantan_part = kalimantan_main.intersection(meratus_zone)
    meratus_geom = clean_poly(unary_union([meratus_kalimantan_part, sebuku_island, pulau_laut]))

    # 8. Seram & Ambon Ultramafic Belt (Western Seram Hoamoal/Piru + Ambon)
    seram_west_zone = box(127.8, -3.8, 128.5, -3.0)
    seram_west_part = seram_main.intersection(seram_west_zone)
    seram_ambon_geom = clean_poly(unary_union([seram_west_part, ambon_island]))

    # 9. Cyclops Mountains Ophiolite Belt (Jayapura / Depapre Papua)
    cyclops_zone = box(140.2, -2.65, 140.75, -2.4)
    cyclops_geom = clean_poly(papua_main.intersection(cyclops_zone))

    # 10. Central Papua & Weyland Suture Belt
    central_papua_zone = box(135.2, -4.3, 137.1, -3.3)
    central_papua_raw = papua_main.intersection(central_papua_zone)
    central_papua_geom = clean_poly(central_papua_raw.difference(cyclops_geom))

    # 11. Aceh - Barisan Ophiolite Suture Belt (Sumatra)
    aceh_zone = box(95.3, 4.4, 96.5, 5.6)
    aceh_geom = clean_poly(sumatra_main.intersection(aceh_zone))

    # 12. Timor-Rote Ophiolite Nappe Belt (West Timor + Rote)
    timor_zone = box(123.4, -10.4, 125.15, -8.9)
    timor_part = timor_main.intersection(timor_zone)
    timor_geom = clean_poly(unary_union([timor_part, rote_island]))

    features_def = [
        {
            "id": "esob",
            "name": "East Sulawesi Ophiolite Belt",
            "tier": "HIGH",
            "province": "Sulawesi Tengah / Tenggara / Selatan",
            "geology": "Kompleks Ofiolit Sulawesi Timur (Peridotit, Harzburgit, Serpentinit Morowali/Kolaka/Pomalaa/Sorowako)",
            "geom": esob_geom
        },
        {
            "id": "halmahera_ophiolite",
            "name": "Halmahera Ophiolite Belt",
            "tier": "HIGH",
            "province": "Maluku Utara",
            "geology": "Kompleks Ofiolit Halmahera Timur & Tengah (Weda Bay, Buli, Maba Laterites)",
            "geom": halmahera_geom
        },
        {
            "id": "obi_ophiolite",
            "name": "Obi Island Ophiolite",
            "tier": "HIGH",
            "province": "Maluku Utara",
            "geology": "Satuan Ultramafik Pulau Obi (Harita/Kawasi Laterite Complex)",
            "geom": obi_geom
        },
        {
            "id": "waigeo_gag_ophiolite",
            "name": "Waigeo-Gag-Gebe Ophiolite Belt",
            "tier": "HIGH",
            "province": "Papua Barat Daya & Maluku Utara",
            "geology": "Ofiolit Kepulauan Raja Ampat (Pulau Gag, Gebe, Waigeo High-Grade Laterite)",
            "geom": waigeo_gag_geom
        },
        {
            "id": "meratus_sebuku",
            "name": "Meratus & Sebuku Ophiolite Belt",
            "tier": "MEDIUM",
            "province": "Kalimantan Selatan",
            "geology": "Kompleks Ofiolit Meratus & P. Sebuku (Peridotit, Harzburgit, Endapan Laterit Fe-Ni-Co)",
            "geom": meratus_geom
        },
        {
            "id": "cyclops_papua",
            "name": "Cyclops Mountains Ophiolite Belt",
            "tier": "MEDIUM",
            "province": "Papua",
            "geology": "Ofiolit Pegunungan Cyclops (Peridotit-Dunit tektonik, Laterit Ni-Co-Sc Jayapura/Depapre)",
            "geom": cyclops_geom
        },
        {
            "id": "seram_ambon",
            "name": "Seram & Ambon Ultramafic Belt",
            "tier": "MEDIUM",
            "province": "Maluku",
            "geology": "Satuan Ultramafik Kompleks Seram Barat & Ambon (Ofiolit terdislokasi Piru/Hoamoal)",
            "geom": seram_ambon_geom
        },
        {
            "id": "banggai_sula",
            "name": "Banggai-Sula Archipelago Ultramafic Belt",
            "tier": "MEDIUM",
            "province": "Sulawesi Tengah & Maluku Utara",
            "geology": "Mikrokontinen Banggai-Sula (Peridotit Suture & Serpentinit Pulau Peleng/Sula)",
            "geom": banggai_sula_geom
        },
        {
            "id": "sulbar_palu_suture",
            "name": "Sulbar & Palu-Koro Suture Belt",
            "tier": "LOW",
            "province": "Sulawesi Barat",
            "geology": "Zona Jahitan Palu-Koro & Mamuju (Sliver Serpentinit, Ofiolit Dislokasi Pasangkayu)",
            "geom": sulbar_geom
        },
        {
            "id": "central_papua_suture",
            "name": "Central Papua & Weyland Suture Belt",
            "tier": "LOW",
            "province": "Papua Tengah",
            "geology": "Zona Suture Pegunungan Tengah Weyland (Singkapan Ofiolit Terisolasi Nabire/Paniai)",
            "geom": central_papua_geom
        },
        {
            "id": "aceh_barisan",
            "name": "Aceh - Barisan Ophiolite Suture Belt",
            "tier": "LOW",
            "province": "Aceh",
            "geology": "Ofiolit Tethys Geumpang-Tangse (Lensa Ultramafik & Serpentinit Barisan)",
            "geom": aceh_geom
        },
        {
            "id": "timor_nappe",
            "name": "Timor-Rote Ophiolite Nappe Belt",
            "tier": "LOW",
            "province": "Nusa Tenggara Timur",
            "geology": "Kompleks Allochthon Nappe Banda (Klippen Ultramafik & Laterit Tipis Mutis/Atambua)",
            "geom": timor_geom
        }
    ]

    out_features = []
    for f in features_def:
        g = f["geom"]
        assert g is not None and g.is_valid, f"Invalid geometry for {f['id']}"
        geojson_geom = mapping(g)
        geojson_geom["coordinates"] = round_coords(geojson_geom["coordinates"], 6)
        
        out_features.append({
            "type": "Feature",
            "properties": {
                "id": f["id"],
                "name": f["name"],
                "tier": f["tier"],
                "province": f["province"],
                "geology": f["geology"]
            },
            "geometry": geojson_geom
        })

    out_fc = {
        "type": "FeatureCollection",
        "name": "indonesia_nickel_belts",
        "features": out_features
    }

    with open(OUTPUT_BELTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(out_fc, f, indent=2)

    print(f"Successfully generated {OUTPUT_BELTS_PATH} with {len(out_features)} features.")

if __name__ == "__main__":
    generate_clean_belts()
