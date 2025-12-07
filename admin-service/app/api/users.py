from fastapi import APIRouter, HTTPException, Query
from uuid import UUID

from app.models.user import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
    UserListResponse,
    AssignRolesRequest,
)
from app.services.user_service import user_service

router = APIRouter(prefix="/tenants/{tenant_id}/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    tenant_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List users in a tenant."""
    try:
        users, total = await user_service.list_users(tenant_id, limit, offset)
        return UserListResponse(
            data=users,
            total=total,
            limit=limit,
            offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(tenant_id: UUID, request: CreateUserRequest):
    """Create a new user in a tenant."""
    try:
        user = await user_service.create_user(tenant_id, request)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(tenant_id: UUID, user_id: UUID):
    """Get a user by ID."""
    user = await user_service.get_user(tenant_id, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(tenant_id: UUID, user_id: UUID, request: UpdateUserRequest):
    """Update a user."""
    user = await user_service.update_user(
        tenant_id,
        user_id,
        first_name=request.first_name,
        last_name=request.last_name,
        status=request.status,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/{user_id}/roles", response_model=UserResponse)
async def assign_roles(tenant_id: UUID, user_id: UUID, request: AssignRolesRequest):
    """Assign roles to a user (replaces existing roles)."""
    user = await user_service.assign_roles(tenant_id, user_id, request.roles)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}/roles/{role}", response_model=UserResponse)
async def remove_role(tenant_id: UUID, user_id: UUID, role: str):
    """Remove a role from a user."""
    user = await user_service.remove_role(tenant_id, user_id, role)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(tenant_id: UUID, user_id: UUID):
    """Delete a user."""
    success = await user_service.delete_user(tenant_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
