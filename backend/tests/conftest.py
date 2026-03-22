"""
Pytest configuration and fixtures for the antibot detection engine.
"""
import os
import asyncio
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
from app.database import Base
from app.config import settings

# Use a test database
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/antibot_test"
)

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()

@pytest.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        # Begin a transaction
        async with session.begin():
            yield session
        # Rollback after test to keep database clean
        await session.rollback()

@pytest.fixture
def client():
    """Create a test HTTP client."""
    from httpx import AsyncClient
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

# Test data fixtures
@pytest.fixture
def sample_rule_data():
    """Sample rule data for testing."""
    return {
        "name": "Block Known Bots",
        "description": "Blocks common bot user agents",
        "condition_type": "user_agent",
        "condition": {"pattern": "Python-urllib|curl|wget"},
        "weight": 30,
        "action": "block",
        "enabled": True
    }

@pytest.fixture
def sample_allowlist_data():
    """Sample allowlist data."""
    return {
        "ip": "192.168.1.0/24",
        "reason": "Internal network",
        "expires_at": None
    }

@pytest.fixture
def admin_token():
    """Admin token for testing."""
    return "test-admin-token"
