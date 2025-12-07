"""
Tenant Management Integration Tests for Admin Service.
"""

import pytest
import httpx
import uuid


@pytest.mark.integration
class TestTenantList:
    """Tests for listing tenants."""

    def test_list_tenants_returns_200(self, http_client: httpx.Client):
        """List tenants should return 200 OK."""
        response = http_client.get("/api/tenants")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    def test_list_tenants_includes_seeded_tenants(self, http_client: httpx.Client):
        """List should include tenants from test seed."""
        response = http_client.get("/api/tenants")

        assert response.status_code == 200
        data = response.json()
        tenants = data["data"]

        slugs = [t["slug"] for t in tenants]
        assert "alpha" in slugs
        assert "beta" in slugs

    def test_tenant_has_required_fields(self, http_client: httpx.Client):
        """Each tenant should have required fields."""
        response = http_client.get("/api/tenants")

        assert response.status_code == 200
        data = response.json()
        tenants = data["data"]

        for tenant in tenants:
            assert "id" in tenant
            assert "name" in tenant
            assert "slug" in tenant
            assert "status" in tenant


@pytest.mark.integration
class TestTenantCreate:
    """Tests for creating tenants."""

    def test_create_tenant_success(
        self, http_client: httpx.Client, test_tenant_data: dict
    ):
        """Should successfully create a new tenant."""
        response = http_client.post("/api/tenants", json=test_tenant_data)

        # May be 200 or 201 depending on implementation
        assert response.status_code in [200, 201]
        data = response.json()

        assert "id" in data
        assert data["slug"] == test_tenant_data["slug"]
        assert data["status"] == "active"

    def test_create_tenant_missing_name(self, http_client: httpx.Client):
        """Should reject tenant creation without name."""
        response = http_client.post(
            "/api/tenants",
            json={
                "slug": "test-missing-name",
                "admin_email": "admin@test.com",
                "admin_password": "password123",
            },
        )

        assert response.status_code in [400, 422]

    def test_create_tenant_missing_slug(self, http_client: httpx.Client):
        """Should reject tenant creation without slug."""
        response = http_client.post(
            "/api/tenants",
            json={
                "name": "Test Company",
                "admin_email": "admin@test.com",
                "admin_password": "password123",
            },
        )

        assert response.status_code in [400, 422]

    def test_create_tenant_duplicate_slug(self, http_client: httpx.Client):
        """Should reject duplicate tenant slug."""
        # alpha tenant already exists from seed
        response = http_client.post(
            "/api/tenants",
            json={
                "name": "Duplicate Alpha",
                "slug": "alpha",
                "admin_email": "dup@alpha.com",
                "admin_first_name": "Dup",
                "admin_last_name": "Admin",
                "admin_password": "password123",
            },
        )

        # Should be conflict or bad request
        assert response.status_code in [400, 409, 422]


@pytest.mark.integration
class TestTenantGet:
    """Tests for getting a specific tenant."""

    def test_get_tenant_by_id(self, http_client: httpx.Client, alpha_tenant: dict):
        """Should return tenant by ID."""
        tenant_id = alpha_tenant["id"]
        response = http_client.get(f"/api/tenants/{tenant_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == tenant_id
        assert data["slug"] == "alpha"

    def test_get_tenant_not_found(self, http_client: httpx.Client):
        """Should return 404 for non-existent tenant."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = http_client.get(f"/api/tenants/{fake_id}")

        assert response.status_code == 404


@pytest.mark.integration
class TestTenantSuspend:
    """Tests for suspending/reactivating tenants."""

    def test_suspend_tenant(self, http_client: httpx.Client, test_tenant_data: dict):
        """Should suspend an active tenant."""
        # First create a tenant
        create_response = http_client.post("/api/tenants", json=test_tenant_data)
        assert create_response.status_code in [200, 201]
        tenant_id = create_response.json()["id"]

        # Suspend it
        suspend_response = http_client.post(f"/api/tenants/{tenant_id}/suspend")

        assert suspend_response.status_code == 200
        assert suspend_response.json()["status"] == "suspended"

    def test_reactivate_tenant(self, http_client: httpx.Client, test_tenant_data: dict):
        """Should reactivate a suspended tenant."""
        # First create and suspend a tenant
        create_response = http_client.post("/api/tenants", json=test_tenant_data)
        assert create_response.status_code in [200, 201]
        tenant_id = create_response.json()["id"]

        http_client.post(f"/api/tenants/{tenant_id}/suspend")

        # Reactivate it
        reactivate_response = http_client.post(f"/api/tenants/{tenant_id}/reactivate")

        assert reactivate_response.status_code == 200
        assert reactivate_response.json()["status"] == "active"


@pytest.mark.integration
class TestTenantDelete:
    """Tests for deleting tenants."""

    def test_delete_tenant(self, http_client: httpx.Client, test_tenant_data: dict):
        """Should delete a tenant."""
        # First create a tenant
        create_response = http_client.post("/api/tenants", json=test_tenant_data)
        assert create_response.status_code in [200, 201]
        tenant_id = create_response.json()["id"]

        # Delete it
        delete_response = http_client.delete(f"/api/tenants/{tenant_id}")

        assert delete_response.status_code in [200, 204]

        # Verify it's gone
        get_response = http_client.get(f"/api/tenants/{tenant_id}")
        assert get_response.status_code == 404

    def test_delete_nonexistent_tenant(self, http_client: httpx.Client):
        """Should return 404 when deleting non-existent tenant."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = http_client.delete(f"/api/tenants/{fake_id}")

        assert response.status_code == 404
