import logging
import asyncpg
from app.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        """Initialize the asyncpg Connection Pool."""
        if self.pool is not None:
            return
        
        try:
            self.pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=5,
                max_size=20,
                max_queries=50000,
                timeout=30.0
            )
            logger.info("Successfully established PostgreSQL/PostGIS connection pool.")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL connection pool: {e}")
            raise e

    async def disconnect(self):
        """Close the asyncpg Connection Pool."""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("PostgreSQL/PostGIS connection pool closed.")

    async def fetch_row(self, query: str, *args):
        """Utility to fetch a single row from the database using a connection from the pool."""
        if not self.pool:
            raise RuntimeError("Database connection pool is not initialized.")
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetch_all(self, query: str, *args):
        """Utility to fetch multiple rows from the database."""
        if not self.pool:
            raise RuntimeError("Database connection pool is not initialized.")
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

db_manager = DatabaseManager()

async def get_db():
    """FastAPI Dependency for accessing the database pool."""
    if not db_manager.pool:
        raise RuntimeError("Database connection pool is not initialized.")
    return db_manager
