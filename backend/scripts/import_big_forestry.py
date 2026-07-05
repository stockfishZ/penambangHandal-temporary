"""
Import Forestry Boundary Data from BIG One Map API into PostGIS.

Downloads the "Penetapan Kawasan Hutan" layer from
BIG One Map KEHUTANAN MapServer and replaces
public.klhk_forestry_boundaries with current official data.

Usage:
    python -m backend.scripts.import_big_forestry [--db-url postgresql://...]
"""
import asyncio
import argparse
import logging
import sys

import asyncpg

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))

from backend.app.big_api import iter_all_features, transform_feature, PAGE_SIZE

BATCH_SIZE = PAGE_SIZE
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_big_forestry")


async def import_forestry_data(db_url: str, dry_run: bool = False) -> int:
    logger.info("Connecting to database...")
    conn = await asyncpg.connect(db_url)

    try:
        if dry_run:
            count = 0
            async for _ in iter_all_features():
                count += 1
            logger.info("DRY RUN — would process %d features", count)
            return count

        async with conn.transaction():
            await conn.execute("""
                CREATE TEMP TABLE tmp_klhk_import (
                    geom geometry(MultiPolygon, 4326),
                    kawasan_hutan VARCHAR(100),
                    kelas_hutan VARCHAR(50),
                    luas_ha NUMERIC,
                    izin_no VARCHAR(100),
                    izin_type VARCHAR(50),
                    source_date DATE
                ) ON COMMIT DROP
            """)
            logger.info("Created temp table tmp_klhk_import")

            inserted = 0
            batch: list[tuple] = []
            async for raw_feat in iter_all_features():
                row = transform_feature(raw_feat)
                if row is None:
                    continue

                geom_text = row["geom_geojson"]
                kawasan = row["kawasan_hutan"]
                kelas = row["kelas_hutan"]
                izin_no = row["izin_no"]
                izin_type = _derive_izin_type(kelas)
                src_date = row["source_date"]

                batch.append((geom_text, kawasan, kelas, izin_no, izin_type, src_date))

                if len(batch) >= BATCH_SIZE:
                    inserted += await _flush_batch(conn, batch)
                    batch.clear()

            if batch:
                inserted += await _flush_batch(conn, batch)
                batch.clear()

            logger.info("Inserted %d features into temp table", inserted)

            await conn.execute("TRUNCATE TABLE public.klhk_forestry_boundaries")
            await conn.execute("""
                INSERT INTO public.klhk_forestry_boundaries
                    (geom, kawasan_hutan, kelas_hutan, luas_ha, izin_no, izin_type, source_date)
                SELECT geom, kawasan_hutan, kelas_hutan, luas_ha, izin_no, izin_type, source_date
                FROM tmp_klhk_import
            """)
            logger.info("Swapped temp table into public.klhk_forestry_boundaries")

        await conn.execute("""
            UPDATE public.klhk_forestry_boundaries
            SET luas_ha = ST_Area(
                ST_Transform(geom, public.get_utm_srid(
                    ST_X(ST_Centroid(geom)),
                    ST_Y(ST_Centroid(geom))
                ))
            ) / 10000.0
            WHERE luas_ha IS NULL
        """)
        logger.info("Computed native PostGIS area for all features")

        await conn.execute("ANALYZE public.klhk_forestry_boundaries")
        logger.info("Analyzed table")

        return inserted

    finally:
        await conn.close()


async def _flush_batch(conn, batch: list[tuple]) -> int:
    if not batch:
        return 0

    values_clauses = []
    params = []
    for geom_text, kawasan, kelas, izin_no, izin_type, src_date in batch:
        ph = len(params) + 1
        values_clauses.append(
            f"(ST_SetSRID(ST_GeomFromGeoJSON(${ph}::text), 4326), "
            f"${ph+1}, ${ph+2}, NULL, ${ph+3}, ${ph+4}, ${ph+5})"
        )
        params.extend([geom_text, kawasan, kelas, izin_no, izin_type, src_date])

    sql = f"""
        INSERT INTO tmp_klhk_import
            (geom, kawasan_hutan, kelas_hutan, luas_ha, izin_no, izin_type, source_date)
        VALUES {', '.join(values_clauses)}
    """
    await conn.execute(sql, *params)
    return len(batch)


def _derive_izin_type(kelas_hutan: str) -> str:
    upper = kelas_hutan.upper()
    if "LINDUNG" in upper:
        return "HL"
    if "KONSERVASI" in upper or "SUAKA" in upper or "PELESTARIAN" in upper:
        return "KSA/KPA"
    if "PRODUKSI" in upper and "KONVERSI" in upper:
        return "HPK"
    if "PRODUKSI" in upper and "TERBATAS" in upper:
        return "HPT"
    if "PRODUKSI" in upper:
        return "HP"
    if "APL" in upper or "PENGGUNAAN LAIN" in upper:
        return "APL"
    return "unknown"


def main():
    parser = argparse.ArgumentParser(
        description="Import KLHK Forestry Boundaries from BIG One Map API"
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="PostgreSQL connection URL (default: from env vars)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and count features from API without writing to database",
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

    total = asyncio.run(import_forestry_data(db_url, dry_run=args.dry_run))
    if not args.dry_run:
        logger.info("Successfully imported %d forestry boundary features", total)
    else:
        logger.info("DRY RUN complete — would import %d features", total)


if __name__ == "__main__":
    main()
