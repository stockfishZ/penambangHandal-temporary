import logging
from typing import Any, AsyncIterator

import httpx

BIG_API_BASE = "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer"
BIG_API_LAYER = 0
PAGE_SIZE = 200  # BIG API drops connections on 1k-feature pages (~76 MB)

FIELD_MAP = {
    "fungsitap": "kelas_hutan",
    "nkws": "kawasan_hutan",
    "nosktap": "izin_no",
    "tglsktap": "source_date",
}

FUNGSI_CODE_MAP: dict[int, str] = {
    1: "Hutan Konservasi",
    2: "Hutan Lindung",
    3: "Hutan Produksi Terbatas",
    4: "Hutan Produksi",
    5: "Hutan Produksi Konversi",
    6: "Areal Penggunaan Lain",
}

NAMA_MAP = {
    "HL": "Hutan Lindung",
    "HP": "Hutan Produksi",
    "HPT": "Hutan Produksi Terbatas",
    "HPK": "Hutan Produksi Konversi",
    "KSA": "Kawasan Suaka Alam",
    "KPA": "Kawasan Pelestarian Alam",
    "TB": "Taman Buru",
    "APL": "Areal Penggunaan Lain",
    "Hutan Konservasi": "Hutan Konservasi",
    "Hutan Lindung": "Hutan Lindung",
    "Hutan Produksi": "Hutan Produksi",
    "Hutan Produksi Terbatas": "Hutan Produksi Terbatas",
    "Hutan Produksi Konversi": "Hutan Produksi Konversi",
    "Areal Penggunaan Lain": "Areal Penggunaan Lain",
}


def resolve_fungsitap(raw: str) -> str:
    s = raw.strip()
    if s in NAMA_MAP:
        return NAMA_MAP[s]
    if s.isdigit() and len(s) >= 2:
        primary = int(s[:1])
        if primary in FUNGSI_CODE_MAP:
            return FUNGSI_CODE_MAP[primary]
        primary2 = int(s[:2])
        if primary2 in FUNGSI_CODE_MAP:
            return FUNGSI_CODE_MAP[primary2]
    return s

logger = logging.getLogger(__name__)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=300.0)


async def get_total_count() -> int:
    params = {
        "where": "1=1",
        "returnCountOnly": "true",
        "f": "json",
    }
    url = f"{BIG_API_BASE}/{BIG_API_LAYER}/query"
    async with _client() as cl:
        resp = await cl.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    return int(data.get("count", 0))


async def fetch_features(
    offset: int = 0,
    limit: int = PAGE_SIZE,
    out_sr: int = 4326,
) -> list[dict[str, Any]]:
    params = {
        "where": "1=1",
        "outFields": ",".join(FIELD_MAP.keys()),
        "returnGeometry": "true",
        "outSR": str(out_sr),
        "resultOffset": str(offset),
        "resultRecordCount": str(limit),
        "f": "geojson",
    }
    url = f"{BIG_API_BASE}/{BIG_API_LAYER}/query"
    async with _client() as cl:
        resp = await cl.get(url, params=params)
        resp.raise_for_status()
        body = resp.json()
    return body.get("features", [])


async def iter_all_features() -> AsyncIterator[dict[str, Any]]:
    total = await get_total_count()
    logger.info("BIG API: total features = %d", total)
    seen = 0
    while seen < total:
        remaining = total - seen
        limit = min(PAGE_SIZE, remaining)
        batch = await fetch_features(offset=seen, limit=limit)
        if not batch:
            break
        for feat in batch:
            yield feat
        seen += len(batch)
        logger.info("BIG API: fetched %d / %d", seen, total)
    logger.info("BIG API: complete — %d features total", seen)


def transform_feature(feat: dict[str, Any]) -> dict[str, Any] | None:
    props = feat.get("properties", {}) or {}
    geometry = feat.get("geometry")
    if not geometry:
        return None

    fungsitap = resolve_fungsitap(props.get("fungsitap") or "")

    tgl_raw = props.get("tglsktap")
    source_date = None
    if tgl_raw and isinstance(tgl_raw, (int, float)):
        import datetime
        source_date = datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=tgl_raw)

    import json
    geom_json = json.dumps(geometry) if not isinstance(geometry, str) else geometry

    return {
        "geom_srid": 4326,
        "geom_geojson": geom_json,
        "kawasan_hutan": (props.get("nkws") or "")[:100] or "unknown",
        "kelas_hutan": fungsitap[:50] or "unknown",
        "izin_no": (props.get("nosktap") or "")[:100] or "unknown",
        "source_date": source_date,
    }


async def query_point(lat: float, lon: float) -> dict[str, Any] | None:
    params = {
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": ",".join(FIELD_MAP.keys()),
        "returnGeometry": "false",
        "f": "json",
    }
    url = f"{BIG_API_BASE}/{BIG_API_LAYER}/query"
    async with _client() as cl:
        resp = await cl.get(url, params=params)
        resp.raise_for_status()
        body = resp.json()
    features = body.get("features", [])
    if not features:
        return None
    feat = features[0]
    props = feat.get("attributes", {})
    fungsitap = resolve_fungsitap(props.get("fungsitap") or "")
    return {
        "source": "big_kesatupeta",
        "kelas_hutan": fungsitap or "unknown",
        "kawasan_hutan": (props.get("nkws") or "")[:100] or "unknown",
        "izin_no": (props.get("nosktap") or "")[:100] or "unknown",
        "query_coordinate": {"lat": lat, "lon": lon},
    }
