"""
Seed the grandfathered_concessions table with synthetic demo data.

Implements Milestone 4.3 Temporal Logic (Keterlanjuran).
Generates realistic-looking synthetic MultiPolygon concessions around known
legacy mining areas in Sulawesi (PT Inco/Vale Sorowako, PT Antam Pomalaa)
plus a coal site in Kalimantan.

⚠️  SYNTHETIC DATA — for development/demo only.  Do not use for production.
    Replace with real IUP/WIUP geometry from ESDM One Map when available.

Usage:
    python -m backend.scripts.seed_grandfathered [--db-url postgresql://...]
    python -m backend.scripts.seed_grandfathered --clear   # remove all synthetic rows
"""
import argparse
import asyncio
import logging
import math
import random
import sys
from datetime import date

import asyncpg

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_grandfathered")

# Synthetic legacy concession definitions.
# Each entry defines a bounding-box region plus random perturbation so the
# resulting MultiPolygon looks natural but is clearly non-authoritative.
# Coordinates are EPSG:4326 (lon/lat).
SYNTHETIC_CONCESSIONS = [
    {
        "concession_name": "Blok Sorowako (SINTETIS — DEMO)",
        "company_name": "PT Vale Indonesia (SINTETIS — DEMO)",
        "izin_no": "DEMO-SOROWAKO-001",
        "status": "Keterlanjuran",
        "source_date": date(1999, 12, 31),
        "notes": "SINTETIS — DEMO DATA. Legacy laterite nickel concession, Sorowako.",
        "centroid_lon": 121.55,
        "centroid_lat": -2.52,
        "width_km": 8.0,
        "height_km": 6.0,
        "num_subpolygons": 3,
    },
    {
        "concession_name": "Blok Pomalaa (SINTETIS — DEMO)",
        "company_name": "PT Antam Tbk (SINTETIS — DEMO)",
        "izin_no": "DEMO-POMALAA-001",
        "status": "Keterlanjuran",
        "source_date": date(2001, 6, 15),
        "notes": "SINTETIS — DEMO DATA. Legacy laterite nickel concession, Pomalaa.",
        "centroid_lon": 121.63,
        "centroid_lat": -4.15,
        "width_km": 6.0,
        "height_km": 5.0,
        "num_subpolygons": 2,
    },
    {
        "concession_name": "Blok Bahodopi (SINTETIS — DEMO)",
        "company_name": "PT Bintangdelapan Mineral (SINTETIS — DEMO)",
        "izin_no": "DEMO-BAHODOPI-001",
        "status": "Keterlanjuran",
        "source_date": date(2005, 3, 20),
        "notes": "SINTETIS — DEMO DATA. Legacy nickel concession, Morowali.",
        "centroid_lon": 121.95,
        "centroid_lat": -2.68,
        "width_km": 5.0,
        "height_km": 4.0,
        "num_subpolygons": 2,
    },
    {
        "concession_name": "Blok Konawe (SINTETIS — DEMO)",
        "company_name": "PT Virtue Dragon (SINTETIS — DEMO)",
        "izin_no": "DEMO-KONAWE-001",
        "status": "Keterlanjuran",
        "source_date": date(2010, 1, 10),
        "notes": "SINTETIS — DEMO DATA. Legacy nickel concession, Konawe.",
        "centroid_lon": 122.05,
        "centroid_lat": -3.95,
        "width_km": 4.0,
        "height_km": 3.5,
        "num_subpolygons": 2,
    },
    {
        "concession_name": "Blok Samarinda (SINTETIS — DEMO)",
        "company_name": "PT Kaltim Prima Coal (SINTETIS — DEMO)",
        "izin_no": "DEMO-KPC-001",
        "status": "Keterlanjuran",
        "source_date": date(1992, 4, 1),
        "notes": "SINTETIS — DEMO DATA. Legacy coal concession, East Kalimantan.",
        "centroid_lon": 117.15,
        "centroid_lat": -0.58,
        "width_km": 10.0,
        "height_km": 7.0,
        "num_subpolygons": 4,
    },
]

SYNTHETIC_SEED = 42


def _generate_polygon_ring(cx: float, cy: float, w_km: float, h_km: float, rng: random.Random, num_points: int = 8) -> str:
    """Generate a WKT polygon ring with random perturbation around a centroid.

    Produces a single ring in WKT format (no outer parentheses) so the caller
    can assemble MultiPolygon / Polygon WKT.
    """
    lon_deg = w_km / 111.32
    lat_deg = h_km / 111.32

    pts = []
    for i in range(num_points):
        angle = (2.0 * math.pi * i) / num_points
        frac = rng.uniform(0.70, 1.0)
        dx = math.cos(angle) * lon_deg * frac
        dy = math.sin(angle) * lat_deg * frac * 1.2
        plon = cx + dx + rng.uniform(-0.01, 0.01)
        plat = cy + dy + rng.uniform(-0.01, 0.01)
        pts.append(f"{plon:.6f} {plat:.6f}")
    pts.append(pts[0])
    return ", ".join(pts)


def _generate_wkt_multipolygon(cfg: dict) -> str:
    """Generate a WKT MultiPolygon string for the given concession config.

    Produces ``num_subpolygons`` irregular polygons within the bounding box,
    with slight negative-buffer gaps between them so the resulting MultiPolygon
    looks like a real concession with disjoint blocks.
    """
    rng = random.Random(SYNTHETIC_SEED)
    polygons = []
    w_km_total = cfg["width_km"]
    h_km_total = cfg["height_km"]
    cx, cy = cfg["centroid_lon"], cfg["centroid_lat"]
    num = cfg["num_subpolygons"]

    sub_width = w_km_total / max(num, 1) * 0.85
    sub_height = h_km_total * 0.80
    gap_km = w_km_total * 0.03

    for i in range(num):
        offset_x = (i - (num - 1) / 2.0) * (sub_width + gap_km) / 111.32
        ring = _generate_polygon_ring(
            cx + offset_x + rng.uniform(-0.005, 0.005),
            cy + rng.uniform(-0.005, 0.005),
            sub_width * rng.uniform(0.8, 1.0),
            sub_height * rng.uniform(0.8, 1.0),
            rng,
        )
        polygons.append(f"(({ring}))")

    return f"MULTIPOLYGON ({', '.join(polygons)})"


async def seed_grandfathered(db_url: str, clear_first: bool = False, dry_run: bool = False) -> int:
    if dry_run:
        logger.info("DRY RUN — would insert %d synthetic concession(s)", len(SYNTHETIC_CONCESSIONS))
        for cfg in SYNTHETIC_CONCESSIONS:
            wkt = _generate_wkt_multipolygon(cfg)
            logger.info("  Would insert: %s | WKT preview: %s…", cfg["concession_name"], wkt[:80])
        return len(SYNTHETIC_CONCESSIONS)

    logger.info("Connecting to database...")
    conn = await asyncio.wait_for(
        asyncpg.connect(db_url),
        timeout=30,
    )

    try:
        if clear_first:
            async with conn.transaction():
                result = await conn.execute("DELETE FROM public.grandfathered_concessions")
                logger.info("Cleared grandfathered_concessions table: %s", result)

        async with conn.transaction():
            inserted = 0
            for cfg in SYNTHETIC_CONCESSIONS:
                wkt = _generate_wkt_multipolygon(cfg)
                await conn.execute(
                    """
                    INSERT INTO public.grandfathered_concessions
                        (geom, concession_name, company_name, izin_no, status, source_date, notes)
                    VALUES
                        (ST_SetSRID(ST_GeomFromText($1::text), 4326), $2, $3, $4, $5, $6, $7)
                    """,
                    wkt,
                    cfg["concession_name"],
                    cfg["company_name"],
                    cfg["izin_no"],
                    cfg["status"],
                    cfg["source_date"],
                    cfg["notes"],
                )
                inserted += 1
                logger.info("  Inserted: %s", cfg["concession_name"])

        await conn.execute("ANALYZE public.grandfathered_concessions")
        logger.info("Analyzed table — %d synthetic concession(s) inserted", inserted)
        return inserted

    except asyncio.TimeoutError:
        logger.error("Database connection timed out after 30s")
        return 0
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Seed grandfathered_concessions with synthetic demo data (Milestone 4.3)"
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="PostgreSQL connection URL (default: from env vars)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete all existing rows before inserting",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be inserted without writing to the database",
    )
    args = parser.parse_args()

    db_url = args.db_url
    if not db_url:
        import os
        from urllib.parse import quote_plus

        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        user = quote_plus(os.getenv("DB_USER", "postgres"))
        password = os.getenv("DB_PASSWORD", "")
        pwd_part = f":{quote_plus(password)}" if password else ""
        name = os.getenv("DB_NAME", "geonirisk")
        db_url = f"postgresql://{user}{pwd_part}@{host}:{port}/{name}"

    total = asyncio.run(seed_grandfathered(db_url, clear_first=args.clear, dry_run=args.dry_run))
    if not args.dry_run:
        logger.info("Seeded %d synthetic grandfathered concession(s)", total)
        print(f"\n⚠️  Data is SYNTHETIC — for development/demo only.")
        print(f"   Replace with real IUP/WIUP geometry from ESDM One Map before production.")
    else:
        logger.info("DRY RUN complete — would insert %d concession(s)", total)


if __name__ == "__main__":
    main()
