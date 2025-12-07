"""Keycloak administration service for tenant provisioning."""

import logging
from typing import Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class KeycloakService:
    """Service for managing Keycloak realms and users."""

    def __init__(self):
        self.base_url = settings.keycloak_url
        self.admin_user = settings.keycloak_admin_user
        self.admin_password = settings.keycloak_admin_password
        self._token: Optional[str] = None

    async def _get_admin_token(self) -> str:
        """Get admin access token from Keycloak."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/realms/master/protocol/openid-connect/token",
                data={
                    "grant_type": "password",
                    "client_id": "admin-cli",
                    "username": self.admin_user,
                    "password": self.admin_password,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    async def _get_headers(self) -> dict:
        """Get authorization headers."""
        token = await self._get_admin_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def create_realm(
        self,
        realm_name: str,
        display_name: str,
    ) -> None:
        """Create a new Keycloak realm for a tenant."""
        logger.info(f"Creating Keycloak realm: {realm_name}")

        headers = await self._get_headers()

        realm_config = {
            "realm": realm_name,
            "enabled": True,
            "displayName": display_name,
            "registrationAllowed": False,
            "resetPasswordAllowed": True,
            "loginWithEmailAllowed": True,
            "duplicateEmailsAllowed": False,
            "sslRequired": "external",
            "roles": {
                "realm": [
                    {"name": "admin", "description": "Tenant administrator"},
                    {"name": "manager", "description": "Project manager"},
                    {"name": "member", "description": "Team member"},
                ]
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/admin/realms",
                headers=headers,
                json=realm_config,
            )
            response.raise_for_status()

        # Create the taskhub-app client
        await self._create_client(realm_name, headers)

        logger.info(f"Keycloak realm created: {realm_name}")

    async def _create_client(self, realm_name: str, headers: dict) -> None:
        """Create the taskhub-app client in the realm."""
        client_config = {
            "clientId": "taskhub-app",
            "enabled": True,
            "publicClient": True,
            "directAccessGrantsEnabled": True,
            "standardFlowEnabled": True,
            "implicitFlowEnabled": False,
            "redirectUris": ["http://localhost:3000/*"],
            "webOrigins": ["+", "http://localhost:3000"],
            "protocol": "openid-connect",
            "attributes": {
                "pkce.code.challenge.method": "S256",
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/admin/realms/{realm_name}/clients",
                headers=headers,
                json=client_config,
            )
            response.raise_for_status()

    async def create_user(
        self,
        realm_name: str,
        email: str,
        first_name: str,
        last_name: str,
        password: str,
        roles: list[str],
    ) -> str:
        """Create a user in the specified realm."""
        logger.info(f"Creating Keycloak user: {email} in realm {realm_name}")

        headers = await self._get_headers()

        user_config = {
            "username": email,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": True,
            "credentials": [
                {
                    "type": "password",
                    "value": password,
                    "temporary": False,
                }
            ],
            "realmRoles": roles,
        }

        async with httpx.AsyncClient() as client:
            # Create user
            response = await client.post(
                f"{self.base_url}/admin/realms/{realm_name}/users",
                headers=headers,
                json=user_config,
            )
            response.raise_for_status()

            # Get user ID from location header
            location = response.headers.get("Location", "")
            user_id = location.split("/")[-1]

            # Assign realm roles
            await self._assign_realm_roles(realm_name, user_id, roles, headers)

            logger.info(f"Keycloak user created: {email} ({user_id})")
            return user_id

    async def _assign_realm_roles(
        self,
        realm_name: str,
        user_id: str,
        roles: list[str],
        headers: dict,
    ) -> None:
        """Assign realm roles to a user."""
        async with httpx.AsyncClient() as client:
            # Get available realm roles
            response = await client.get(
                f"{self.base_url}/admin/realms/{realm_name}/roles",
                headers=headers,
            )
            response.raise_for_status()
            available_roles = response.json()

            # Find matching roles
            roles_to_assign = [
                {"id": r["id"], "name": r["name"]}
                for r in available_roles
                if r["name"] in roles
            ]

            if roles_to_assign:
                # Assign roles to user
                response = await client.post(
                    f"{self.base_url}/admin/realms/{realm_name}/users/{user_id}/role-mappings/realm",
                    headers=headers,
                    json=roles_to_assign,
                )
                response.raise_for_status()

    async def delete_user(self, realm_name: str, user_id: str) -> None:
        """Delete a user from a realm."""
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/admin/realms/{realm_name}/users/{user_id}",
                headers=headers,
            )
            response.raise_for_status()

        logger.info(f"Keycloak user deleted: {user_id}")

    async def get_user_by_email(
        self, realm_name: str, email: str
    ) -> Optional[dict]:
        """Find a user by email in a realm."""
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/admin/realms/{realm_name}/users",
                headers=headers,
                params={"email": email, "exact": "true"},
            )
            response.raise_for_status()
            users = response.json()
            return users[0] if users else None

    async def delete_realm(self, realm_name: str) -> None:
        """Delete a Keycloak realm."""
        logger.info(f"Deleting Keycloak realm: {realm_name}")

        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/admin/realms/{realm_name}",
                headers=headers,
            )
            # Ignore 404 if realm doesn't exist
            if response.status_code != 404:
                response.raise_for_status()

        logger.info(f"Keycloak realm deleted: {realm_name}")

    async def realm_exists(self, realm_name: str) -> bool:
        """Check if a realm exists."""
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/admin/realms/{realm_name}",
                headers=headers,
            )
            return response.status_code == 200


keycloak_service = KeycloakService()
