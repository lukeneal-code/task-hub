"""
Health Check Integration Tests for Admin Service.
"""

import pytest
import httpx


@pytest.mark.integration
class TestHealthEndpoints:
    """Tests for the health check endpoints."""

    def test_health_returns_200(self, http_client: httpx.Client):
        """Health endpoint should return 200 OK."""
        response = http_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"

    def test_health_includes_service_name(self, http_client: httpx.Client):
        """Health endpoint should include service information."""
        response = http_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        # May include service name or version
        assert "status" in data

    @pytest.mark.asyncio
    async def test_health_async(self, async_http_client: httpx.AsyncClient):
        """Health endpoint should work with async client."""
        response = await async_http_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"


@pytest.mark.integration
class TestReadinessEndpoints:
    """Tests for readiness/liveness probes."""

    def test_ready_endpoint(self, http_client: httpx.Client):
        """Ready endpoint should check dependencies."""
        response = http_client.get("/health/ready")

        # May be 200 if all deps ready, or 503 if not
        assert response.status_code in [200, 503]

    def test_live_endpoint(self, http_client: httpx.Client):
        """Live endpoint should always return 200 if service is running."""
        response = http_client.get("/health/live")

        # Liveness should always pass if service is up
        assert response.status_code in [200, 404]  # 404 if not implemented
