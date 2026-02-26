"""
Pytest configuration and shared fixtures for admin-service tests.
"""

import os
import pytest
import httpx
from typing import Generator, AsyncGenerator

# Test configuration
TEST_CONFIG = {
    "admin_api_url": os.environ.get("ADMIN_API_URL", "http://localhost:8001"),
    "keycloak_url": os.environ.get("KEYCLOAK_URL", "http://localhost:8081"),
    "database_url": os.environ.get(
        "DATABASE_URL",
        "postgresql://taskhub_test:test_secret@localhost:5434/taskhub_test"
    ),
    # Test tenants (from test-seed.sql)
    "tenants": {
        "alpha": {
            "id": "11111111-1111-1111-1111-111111111111",
            "slug": "alpha",
            "realm": "alpha",
            "schema": "tenant_alpha",
        },
        "beta": {
            "id": "22222222-2222-2222-2222-222222222222",
            "slug": "beta",
            "realm": "beta",
            "schema": "tenant_beta",
        },
    },
    # Test users
    "users": {
        "alpha": {
            "admin": {
                "id": "aaaa1111-1111-1111-1111-111111111111",
                "email": "admin@alpha.com",
                "password": "password123",
            },
        },
        "beta": {
            "admin": {
                "id": "bbbb1111-1111-1111-1111-111111111111",
                "email": "admin@beta.com",
                "password": "password123",
            },
        },
    },
}


@pytest.fixture(scope="session")
def api_url() -> str:
    """Returns the admin API base URL."""
    return TEST_CONFIG["admin_api_url"]


@pytest.fixture(scope="session")
def keycloak_url() -> str:
    """Returns the Keycloak base URL."""
    return TEST_CONFIG["keycloak_url"]


@pytest.fixture
def http_client(api_url: str) -> Generator[httpx.Client, None, None]:
    """Provides an HTTP client for testing."""
    with httpx.Client(base_url=api_url, timeout=30.0) as client:
        yield client


@pytest.fixture
async def async_http_client(api_url: str) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provides an async HTTP client for testing."""
    async with httpx.AsyncClient(base_url=api_url, timeout=30.0) as client:
        yield client


@pytest.fixture
def test_tenant_data():
    """Returns valid tenant creation data."""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    return {
        "name": f"Test Company {unique_id}",
        "slug": f"test-{unique_id}",
        "admin_email": f"admin-{unique_id}@test.com",
        "admin_first_name": "Test",
        "admin_last_name": "Admin",
        "admin_password": "TestPassword123!",
    }


@pytest.fixture
def alpha_tenant():
    """Returns Alpha tenant configuration."""
    return TEST_CONFIG["tenants"]["alpha"]


@pytest.fixture
def beta_tenant():
    """Returns Beta tenant configuration."""
    return TEST_CONFIG["tenants"]["beta"]


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "isolation: marks tests as tenant isolation tests"
    )
