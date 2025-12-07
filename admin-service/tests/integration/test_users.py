"""
User Management Integration Tests for Admin Service.
"""

import pytest
import httpx
import uuid


@pytest.mark.integration
class TestUserList:
    """Tests for listing users in a tenant."""

    def test_list_users_returns_200(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """List users should return 200 OK."""
        tenant_id = alpha_tenant["id"]
        response = http_client.get(f"/api/tenants/{tenant_id}/users")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    def test_list_users_includes_seeded_users(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """List should include users from test seed."""
        tenant_id = alpha_tenant["id"]
        response = http_client.get(f"/api/tenants/{tenant_id}/users")

        assert response.status_code == 200
        data = response.json()
        users = data["data"]

        emails = [u["email"] for u in users]
        assert "admin@alpha.com" in emails

    def test_list_users_nonexistent_tenant(self, http_client: httpx.Client):
        """Should return 404 for non-existent tenant."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = http_client.get(f"/api/tenants/{fake_id}/users")

        assert response.status_code == 404


@pytest.mark.integration
class TestUserCreate:
    """Tests for creating users in a tenant."""

    def test_create_user_success(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should successfully create a new user."""
        tenant_id = alpha_tenant["id"]
        unique_id = str(uuid.uuid4())[:8]

        user_data = {
            "email": f"testuser-{unique_id}@alpha.com",
            "first_name": "Test",
            "last_name": "User",
            "password": "TestPassword123!",
            "roles": ["member"],
        }

        response = http_client.post(
            f"/api/tenants/{tenant_id}/users", json=user_data
        )

        assert response.status_code in [200, 201]
        data = response.json()

        assert "id" in data
        assert data["email"] == user_data["email"]

    def test_create_user_missing_email(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should reject user creation without email."""
        tenant_id = alpha_tenant["id"]

        response = http_client.post(
            f"/api/tenants/{tenant_id}/users",
            json={
                "first_name": "No",
                "last_name": "Email",
                "password": "password123",
            },
        )

        assert response.status_code in [400, 422]

    def test_create_user_invalid_email(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should reject user creation with invalid email."""
        tenant_id = alpha_tenant["id"]

        response = http_client.post(
            f"/api/tenants/{tenant_id}/users",
            json={
                "email": "not-an-email",
                "first_name": "Invalid",
                "last_name": "Email",
                "password": "password123",
            },
        )

        assert response.status_code in [400, 422]

    def test_create_user_duplicate_email(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should reject duplicate email within tenant."""
        tenant_id = alpha_tenant["id"]

        response = http_client.post(
            f"/api/tenants/{tenant_id}/users",
            json={
                "email": "admin@alpha.com",  # Already exists
                "first_name": "Duplicate",
                "last_name": "Admin",
                "password": "password123",
            },
        )

        assert response.status_code in [400, 409, 422]


@pytest.mark.integration
class TestUserRoles:
    """Tests for assigning roles to users."""

    def test_assign_role_to_user(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should successfully assign a role to a user."""
        tenant_id = alpha_tenant["id"]
        unique_id = str(uuid.uuid4())[:8]

        # First create a user
        user_data = {
            "email": f"roletest-{unique_id}@alpha.com",
            "first_name": "Role",
            "last_name": "Test",
            "password": "TestPassword123!",
            "roles": ["member"],
        }

        create_response = http_client.post(
            f"/api/tenants/{tenant_id}/users", json=user_data
        )
        assert create_response.status_code in [200, 201]
        user_id = create_response.json()["id"]

        # Assign manager role
        role_response = http_client.post(
            f"/api/tenants/{tenant_id}/users/{user_id}/roles",
            json={"roles": ["manager"]},
        )

        assert role_response.status_code == 200


@pytest.mark.integration
class TestUserDelete:
    """Tests for deleting users from a tenant."""

    def test_delete_user(self, http_client: httpx.Client, alpha_tenant: dict):
        """Should delete a user."""
        tenant_id = alpha_tenant["id"]
        unique_id = str(uuid.uuid4())[:8]

        # First create a user
        user_data = {
            "email": f"deletetest-{unique_id}@alpha.com",
            "first_name": "Delete",
            "last_name": "Test",
            "password": "TestPassword123!",
        }

        create_response = http_client.post(
            f"/api/tenants/{tenant_id}/users", json=user_data
        )
        assert create_response.status_code in [200, 201]
        user_id = create_response.json()["id"]

        # Delete the user
        delete_response = http_client.delete(
            f"/api/tenants/{tenant_id}/users/{user_id}"
        )

        assert delete_response.status_code in [200, 204]

    def test_delete_nonexistent_user(
        self, http_client: httpx.Client, alpha_tenant: dict
    ):
        """Should return 404 when deleting non-existent user."""
        tenant_id = alpha_tenant["id"]
        fake_user_id = "00000000-0000-0000-0000-000000000000"

        response = http_client.delete(
            f"/api/tenants/{tenant_id}/users/{fake_user_id}"
        )

        assert response.status_code == 404
