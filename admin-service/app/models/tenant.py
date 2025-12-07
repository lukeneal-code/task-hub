from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Any
from datetime import datetime
from uuid import UUID
import re


class CreateTenantRequest(BaseModel):
    """Request model for creating a new tenant."""

    name: str = Field(..., min_length=2, max_length=255, description="Organization name")
    slug: str = Field(..., min_length=2, max_length=100, description="URL-friendly identifier")
    admin_email: EmailStr = Field(..., description="Initial admin user email")
    admin_first_name: str = Field(..., min_length=1, max_length=100)
    admin_last_name: str = Field(..., min_length=1, max_length=100)
    admin_password: str = Field(..., min_length=8, description="Admin password (min 8 chars)")
    settings: Optional[dict[str, Any]] = Field(default_factory=dict)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens only")
        return v


class UpdateTenantRequest(BaseModel):
    """Request model for updating tenant settings."""

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    settings: Optional[dict[str, Any]] = None


class TenantResponse(BaseModel):
    """Response model for a tenant."""

    id: UUID
    name: str
    slug: str
    status: str
    schema_name: str
    settings: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    user_count: Optional[int] = None

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """Response model for listing tenants with pagination."""

    data: list[TenantResponse]
    total: int
    limit: int
    offset: int
