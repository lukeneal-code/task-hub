"""
Authentication helper for admin service tests.

Provides functions to obtain tokens and authenticate with Keycloak.
"""

import os
import httpx
from typing import Optional

KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://localhost:8081")
KEYCLOAK_ADMIN_USER = os.environ.get("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")

# Token cache
_admin_token_cache: Optional[str] = None


async def get_keycloak_admin_token() -> str:
    """
    Gets an admin token from Keycloak for administrative operations.
    Uses caching to avoid repeated requests.
    """
    global _admin_token_cache

    if _admin_token_cache:
        return _admin_token_cache

    token_url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": KEYCLOAK_ADMIN_USER,
                "password": KEYCLOAK_ADMIN_PASSWORD,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise Exception(f"Failed to get admin token: {response.text}")

        _admin_token_cache = response.json()["access_token"]
        return _admin_token_cache


async def get_user_token(realm: str, username: str, password: str) -> str:
    """
    Gets a user token from Keycloak for a specific realm.
    """
    token_url = f"{KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/token"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            data={
                "grant_type": "password",
                "client_id": "taskhub-app",
                "username": username,
                "password": password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise Exception(f"Failed to get user token: {response.text}")

        return response.json()["access_token"]


def clear_token_cache():
    """Clears the token cache."""
    global _admin_token_cache
    _admin_token_cache = None


async def wait_for_keycloak(max_attempts: int = 30, delay_seconds: int = 2) -> bool:
    """
    Waits for Keycloak to be ready.
    """
    import asyncio

    health_url = f"{KEYCLOAK_URL}/health/ready"

    async with httpx.AsyncClient() as client:
        for i in range(max_attempts):
            try:
                response = await client.get(health_url)
                if response.status_code == 200:
                    print(f"Keycloak ready after {i + 1} attempts")
                    return True
            except Exception:
                pass
            await asyncio.sleep(delay_seconds)

    return False
