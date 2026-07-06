import argparse
import asyncio
import logging
import os
import asyncpg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_osm")

async def seed_osm(db_url: str):
    logger.info("Connecting to database...")
    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        logger.error(f"Failed to connect to DB: {e}. Is PostgreSQL running?")
        return

    try:
        async with conn.transaction():
            # Create schema if not exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS osm_roads (
                    id SERIAL PRIMARY KEY,
                    geom geometry(LineString, 4326),
                    type VARCHAR(50)
                );
                CREATE TABLE IF NOT EXISTS osm_waterways (
                    id SERIAL PRIMARY KEY,
                    geom geometry(LineString, 4326),
                    type VARCHAR(50)
                );
                CREATE TABLE IF NOT EXISTS klhk_forestry_boundaries (
                    id SERIAL PRIMARY KEY,
                    geom geometry(MultiPolygon, 4326),
                    kawasan_hutan VARCHAR(100),
                    kelas_hutan VARCHAR(50),
                    luas_ha NUMERIC,
                    izin_no VARCHAR(100),
                    izin_type VARCHAR(50),
                    source_date DATE
                );
            """)

            await conn.execute("TRUNCATE TABLE osm_roads, osm_waterways, klhk_forestry_boundaries RESTART IDENTITY CASCADE")
            
            # Halmahera Weda Bay dummy lines
            # Road traversing near study area
            await conn.execute("""
                INSERT INTO osm_roads (geom, type)
                VALUES (ST_SetSRID(ST_GeomFromText('LINESTRING(127.60 -0.45, 127.65 -0.40, 127.70 -0.35)'), 4326), 'primary')
            """)

            # River traversing near study area
            await conn.execute("""
                INSERT INTO osm_waterways (geom, type)
                VALUES (ST_SetSRID(ST_GeomFromText('LINESTRING(127.65 -0.35, 127.68 -0.42, 127.70 -0.45)'), 4326), 'river')
            """)
            
            # Hutan Lindung (Kill Zone dummy polygon) overlapping part of the grid
            await conn.execute("""
                INSERT INTO klhk_forestry_boundaries (geom, kelas_hutan, kawasan_hutan)
                VALUES (ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((127.70 -0.45, 127.75 -0.45, 127.75 -0.40, 127.70 -0.40, 127.70 -0.45)))'), 4326), 'HUTAN LINDUNG', 'HL Weda')
            """)
            
            # Create spatial indices
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_osm_roads_geom ON osm_roads USING GIST (geom);")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_osm_waterways_geom ON osm_waterways USING GIST (geom);")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_klhk_geom ON klhk_forestry_boundaries USING GIST (geom);")
            
            logger.info("Successfully seeded OSM roads, waterways, and KLHK boundaries.")
    except Exception as e:
        logger.error(f"Error seeding OSM: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/geonirisk"))
    args = parser.parse_args()
    asyncio.run(seed_osm(args.db_url))
