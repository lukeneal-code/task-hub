from fastapi import APIRouter, HTTPException, Query
from uuid import UUID
from typing import Optional

from app.models.tenant import (
    CreateTenantRequest,
    UpdateTenantRequest,
    TenantResponse,
    TenantListResponse,
)
from app.services.tenant_service import tenant_service

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    status: Optional[str] = Query(None, pattern="^(active|suspended|pending)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List all tenants with optional filtering."""
    tenants, total = await tenant_service.list_tenants(status, limit, offset)
    return TenantListResponse(
        data=tenants,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TenantResponse, status_code=201)
async def create_tenant(request: CreateTenantRequest):
    """Create a new tenant with Cognito User Pool and database schema."""
    try:
        tenant = await tenant_service.create_tenant(request)
        return tenant
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lookup/{slug}", response_model=TenantResponse)
async def lookup_tenant(slug: str):
    """Look up a tenant by slug (public endpoint for login flow)."""
    tenant = await tenant_service.get_tenant_by_slug(slug)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: UUID):
    """Get a tenant by ID."""
    tenant = await tenant_service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: UUID, request: UpdateTenantRequest):
    """Update tenant name and/or settings."""
    tenant = await tenant_service.update_tenant(
        tenant_id, name=request.name, settings=request.settings
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/{tenant_id}/suspend", status_code=204)
async def suspend_tenant(tenant_id: UUID, reason: str = Query(...)):
    """Suspend a tenant."""
    tenant = await tenant_service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    await tenant_service.suspend_tenant(tenant_id, reason)


@router.post("/{tenant_id}/reactivate", status_code=204)
async def reactivate_tenant(tenant_id: UUID):
    """Reactivate a suspended tenant."""
    tenant = await tenant_service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    await tenant_service.reactivate_tenant(tenant_id)


@router.delete("/{tenant_id}", status_code=204)
async def delete_tenant(tenant_id: UUID):
    """Permanently delete a tenant and all its data."""
    try:
        await tenant_service.delete_tenant(tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
