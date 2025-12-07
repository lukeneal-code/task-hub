from uuid import UUID, uuid4
from typing import Optional
import logging
import json
import re

from app import database as db
from app.models.tenant import CreateTenantRequest, TenantResponse
from app.services.keycloak_service import keycloak_service

logger = logging.getLogger(__name__)


class TenantService:
    """Service for tenant lifecycle management."""

    async def create_tenant(self, request: CreateTenantRequest) -> TenantResponse:
        """
        Provision a new tenant with:
        1. Database record
        2. Keycloak realm
        3. Database schema
        4. Admin user (in both Keycloak and DB)
        """
        tenant_id = uuid4()
        schema_name = f"tenant_{re.sub(r'[^a-z0-9]', '_', request.slug.lower())}"
        realm_name = request.slug  # Use slug as realm name

        logger.info(f"Creating tenant: {request.name} ({request.slug})")

        # Step 1: Insert tenant record with pending status
        await db.execute(
            """
            INSERT INTO platform.tenants (id, name, slug, schema_name, keycloak_realm, status, settings)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            """,
            tenant_id,
            request.name,
            request.slug,
            schema_name,
            realm_name,
            json.dumps(request.settings or {}),
        )

        try:
            # Step 2: Create Keycloak realm
            await keycloak_service.create_realm(realm_name, request.name)

            # Step 3: Create database schema
            await db.create_tenant_schema(schema_name)

            # Step 4: Create admin user in Keycloak
            keycloak_user_id = await keycloak_service.create_user(
                realm_name=realm_name,
                email=request.admin_email,
                first_name=request.admin_first_name,
                last_name=request.admin_last_name,
                password=request.admin_password,
                roles=["admin"],
            )

            # Step 5: Create admin user in tenant database
            user_id = uuid4()
            async with db.get_connection() as conn:
                await conn.execute(f'SET search_path TO "{schema_name}"')
                await conn.execute(
                    """
                    INSERT INTO users (id, email, first_name, last_name, password_hash, role, status)
                    VALUES ($1, $2, $3, $4, $5, 'admin', 'active')
                    """,
                    user_id,
                    request.admin_email,
                    request.admin_first_name,
                    request.admin_last_name,
                    keycloak_user_id,  # Store Keycloak ID instead of password hash
                )

            # Step 6: Activate tenant
            await db.execute(
                """
                UPDATE platform.tenants
                SET status = 'active', updated_at = NOW()
                WHERE id = $1
                """,
                tenant_id,
            )

            logger.info(f"Tenant created successfully: {tenant_id}")

            # Fetch and return the created tenant
            return await self.get_tenant(tenant_id)

        except Exception as e:
            logger.error(f"Failed to create tenant: {e}")
            # Cleanup on failure
            await self._cleanup_failed_tenant(tenant_id, schema_name, realm_name)
            raise

    def _hash_password(self, password: str) -> str:
        """Simple password hashing (use bcrypt in production)."""
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()

    async def _cleanup_failed_tenant(
        self, tenant_id: UUID, schema_name: str, realm_name: str
    ) -> None:
        """Clean up resources after a failed tenant creation."""
        try:
            # Delete Keycloak realm
            try:
                await keycloak_service.delete_realm(realm_name)
            except Exception as e:
                logger.error(f"Failed to delete Keycloak realm: {e}")

            # Drop schema
            try:
                await db.drop_tenant_schema(schema_name)
            except Exception as e:
                logger.error(f"Failed to drop schema: {e}")

            # Delete tenant record
            await db.execute("DELETE FROM platform.tenants WHERE id = $1", tenant_id)

        except Exception as e:
            logger.error(f"Cleanup failed: {e}")

    async def list_tenants(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[TenantResponse], int]:
        """List tenants with optional filtering and pagination."""
        where_clause = ""
        params = []

        if status:
            where_clause = "WHERE status = $1"
            params.append(status)

        # Get total count
        count_query = f"SELECT COUNT(*) FROM platform.tenants {where_clause}"
        total = await db.fetchval(count_query, *params)

        # Get tenants
        query = f"""
            SELECT t.*, (
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = t.schema_name AND table_name = 'users'
            ) as has_users
            FROM platform.tenants t
            {where_clause}
            ORDER BY t.created_at DESC
            LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """
        params.extend([limit, offset])

        rows = await db.fetch(query, *params)

        tenants = []
        for row in rows:
            tenant = TenantResponse(
                id=row["id"],
                name=row["name"],
                slug=row["slug"],
                status=row["status"],
                schema_name=row["schema_name"],
                settings=json.loads(row["settings"]) if row["settings"] else {},
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

            # Get user count if schema exists
            if row["has_users"]:
                try:
                    count = await db.fetchval(
                        f'SELECT COUNT(*) FROM "{row["schema_name"]}".users'
                    )
                    tenant.user_count = count
                except Exception:
                    tenant.user_count = 0

            tenants.append(tenant)

        return tenants, total

    async def get_tenant(self, tenant_id: UUID) -> Optional[TenantResponse]:
        """Get a tenant by ID."""
        row = await db.fetchrow(
            "SELECT * FROM platform.tenants WHERE id = $1", tenant_id
        )

        if not row:
            return None

        tenant = TenantResponse(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            status=row["status"],
            schema_name=row["schema_name"],
            settings=json.loads(row["settings"]) if row["settings"] else {},
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

        # Get user count
        try:
            count = await db.fetchval(
                f'SELECT COUNT(*) FROM "{row["schema_name"]}".users'
            )
            tenant.user_count = count
        except Exception:
            tenant.user_count = 0

        return tenant

    async def get_tenant_by_slug(self, slug: str) -> Optional[TenantResponse]:
        """Get a tenant by slug."""
        row = await db.fetchrow(
            "SELECT * FROM platform.tenants WHERE slug = $1", slug
        )

        if not row:
            return None

        return await self.get_tenant(row["id"])

    async def update_tenant(
        self, tenant_id: UUID, name: Optional[str] = None, settings: Optional[dict] = None
    ) -> Optional[TenantResponse]:
        """Update tenant name and/or settings."""
        updates = []
        params = []
        param_idx = 1

        if name is not None:
            updates.append(f"name = ${param_idx}")
            params.append(name)
            param_idx += 1

        if settings is not None:
            updates.append(f"settings = ${param_idx}")
            params.append(json.dumps(settings))
            param_idx += 1

        if not updates:
            return await self.get_tenant(tenant_id)

        updates.append("updated_at = NOW()")
        params.append(tenant_id)

        query = f"""
            UPDATE platform.tenants
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
        """

        await db.execute(query, *params)
        return await self.get_tenant(tenant_id)

    async def suspend_tenant(self, tenant_id: UUID, reason: str) -> None:
        """Suspend a tenant."""
        await db.execute(
            """
            UPDATE platform.tenants
            SET status = 'suspended', updated_at = NOW()
            WHERE id = $1
            """,
            tenant_id,
        )
        logger.info(f"Suspended tenant {tenant_id}: {reason}")

    async def reactivate_tenant(self, tenant_id: UUID) -> None:
        """Reactivate a suspended tenant."""
        await db.execute(
            """
            UPDATE platform.tenants
            SET status = 'active', updated_at = NOW()
            WHERE id = $1
            """,
            tenant_id,
        )
        logger.info(f"Reactivated tenant {tenant_id}")

    async def delete_tenant(self, tenant_id: UUID) -> None:
        """Permanently delete a tenant and all its data."""
        tenant = await db.fetchrow(
            "SELECT * FROM platform.tenants WHERE id = $1", tenant_id
        )

        if not tenant:
            raise ValueError("Tenant not found")

        logger.info(f"Deleting tenant: {tenant_id}")

        # Delete Keycloak realm
        if tenant.get("keycloak_realm"):
            try:
                await keycloak_service.delete_realm(tenant["keycloak_realm"])
            except Exception as e:
                logger.error(f"Failed to delete Keycloak realm: {e}")

        # Drop database schema
        try:
            await db.drop_tenant_schema(tenant["schema_name"])
        except Exception as e:
            logger.error(f"Failed to drop schema: {e}")

        # Delete tenant record
        await db.execute("DELETE FROM platform.tenants WHERE id = $1", tenant_id)

        logger.info(f"Tenant deleted: {tenant_id}")


tenant_service = TenantService()
