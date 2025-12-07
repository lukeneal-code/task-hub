from uuid import UUID, uuid4
from typing import Optional
import logging
import hashlib

from app import database as db
from app.models.user import CreateUserRequest, UserResponse
from app.services.keycloak_service import keycloak_service

logger = logging.getLogger(__name__)


class UserService:
    """Service for user management within tenants."""

    def _hash_password(self, password: str) -> str:
        """Simple password hashing (use bcrypt in production)."""
        return hashlib.sha256(password.encode()).hexdigest()

    async def create_user(
        self, tenant_id: UUID, request: CreateUserRequest
    ) -> UserResponse:
        """Create a new user in a tenant (Keycloak + database)."""
        # Get tenant info
        tenant = await db.fetchrow(
            "SELECT * FROM platform.tenants WHERE id = $1", tenant_id
        )

        if not tenant:
            raise ValueError("Tenant not found")

        realm_name = tenant.get("keycloak_realm") or tenant["slug"]
        logger.info(f"Creating user {request.email} in tenant {tenant_id}")

        # Create user in Keycloak
        roles = request.roles if request.roles else ["member"]
        keycloak_user_id = await keycloak_service.create_user(
            realm_name=realm_name,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            password=request.password,
            roles=roles,
        )

        # Create user in tenant database
        user_id = uuid4()
        primary_role = roles[0]

        async with db.get_connection() as conn:
            await conn.execute(f'SET search_path TO "{tenant["schema_name"]}"')
            await conn.execute(
                """
                INSERT INTO users (id, email, first_name, last_name, password_hash, role, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
                """,
                user_id,
                request.email,
                request.first_name,
                request.last_name,
                keycloak_user_id,  # Store Keycloak ID
                primary_role,
            )

        return await self.get_user(tenant_id, user_id)

    async def list_users(
        self,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[UserResponse], int]:
        """List users in a tenant."""
        tenant = await db.fetchrow(
            "SELECT schema_name FROM platform.tenants WHERE id = $1",
            tenant_id,
        )

        if not tenant:
            raise ValueError("Tenant not found")

        # Get total count
        total = await db.fetchval(
            f'SELECT COUNT(*) FROM "{tenant["schema_name"]}".users'
        )

        # Get users
        async with db.get_connection() as conn:
            await conn.execute(f'SET search_path TO "{tenant["schema_name"]}"')
            rows = await conn.fetch(
                """
                SELECT * FROM users
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset,
            )

        users = []
        for row in rows:
            users.append(
                UserResponse(
                    id=row["id"],
                    email=row["email"],
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    role=row["role"],
                    roles=[row["role"]],
                    status=row["status"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )

        return users, total

    async def get_user(self, tenant_id: UUID, user_id: UUID) -> Optional[UserResponse]:
        """Get a user by ID."""
        tenant = await db.fetchrow(
            "SELECT schema_name FROM platform.tenants WHERE id = $1",
            tenant_id,
        )

        if not tenant:
            return None

        row = await db.fetchrow(
            f'SELECT * FROM "{tenant["schema_name"]}".users WHERE id = $1',
            user_id,
        )

        if not row:
            return None

        return UserResponse(
            id=row["id"],
            email=row["email"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            role=row["role"],
            roles=[row["role"]],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def update_user(
        self,
        tenant_id: UUID,
        user_id: UUID,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Optional[UserResponse]:
        """Update a user."""
        tenant = await db.fetchrow(
            "SELECT schema_name FROM platform.tenants WHERE id = $1", tenant_id
        )

        if not tenant:
            return None

        updates = []
        params = []
        param_idx = 1

        if first_name is not None:
            updates.append(f"first_name = ${param_idx}")
            params.append(first_name)
            param_idx += 1

        if last_name is not None:
            updates.append(f"last_name = ${param_idx}")
            params.append(last_name)
            param_idx += 1

        if status is not None:
            updates.append(f"status = ${param_idx}")
            params.append(status)
            param_idx += 1

        if not updates:
            return await self.get_user(tenant_id, user_id)

        updates.append("updated_at = NOW()")
        params.append(user_id)

        query = f"""
            UPDATE "{tenant["schema_name"]}".users
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
        """

        await db.execute(query, *params)
        return await self.get_user(tenant_id, user_id)

    async def assign_roles(
        self, tenant_id: UUID, user_id: UUID, roles: list[str]
    ) -> Optional[UserResponse]:
        """Assign roles to a user."""
        tenant = await db.fetchrow(
            "SELECT schema_name FROM platform.tenants WHERE id = $1",
            tenant_id,
        )

        if not tenant:
            return None

        user = await self.get_user(tenant_id, user_id)
        if not user:
            return None

        # Update primary role in database
        primary_role = roles[0] if roles else "member"
        await db.execute(
            f"""
            UPDATE "{tenant["schema_name"]}".users
            SET role = $1, updated_at = NOW()
            WHERE id = $2
            """,
            primary_role,
            user_id,
        )

        return await self.get_user(tenant_id, user_id)

    async def remove_role(
        self, tenant_id: UUID, user_id: UUID, role: str
    ) -> Optional[UserResponse]:
        """Remove a role from a user (sets to member if last role)."""
        tenant = await db.fetchrow(
            "SELECT schema_name FROM platform.tenants WHERE id = $1",
            tenant_id,
        )

        if not tenant:
            return None

        user = await self.get_user(tenant_id, user_id)
        if not user:
            return None

        # Set to member if role is being removed
        await db.execute(
            f"""
            UPDATE "{tenant["schema_name"]}".users
            SET role = 'member', updated_at = NOW()
            WHERE id = $1
            """,
            user_id,
        )

        return await self.get_user(tenant_id, user_id)

    async def delete_user(self, tenant_id: UUID, user_id: UUID) -> bool:
        """Delete a user from both Keycloak and database."""
        tenant = await db.fetchrow(
            "SELECT * FROM platform.tenants WHERE id = $1",
            tenant_id,
        )

        if not tenant:
            return False

        user = await self.get_user(tenant_id, user_id)
        if not user:
            return False

        logger.info(f"Deleting user {user.email} from tenant {tenant_id}")

        # Get realm name
        realm_name = tenant.get("keycloak_realm") or tenant["slug"]

        # Delete from Keycloak
        try:
            keycloak_user = await keycloak_service.get_user_by_email(
                realm_name, user.email
            )
            if keycloak_user:
                await keycloak_service.delete_user(realm_name, keycloak_user["id"])
        except Exception as e:
            logger.error(f"Failed to delete user from Keycloak: {e}")

        # Delete from database
        await db.execute(
            f'DELETE FROM "{tenant["schema_name"]}".users WHERE id = $1',
            user_id,
        )

        return True


user_service = UserService()
