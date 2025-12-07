from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


VALID_ROLES = {"admin", "manager", "member"}


class CreateUserRequest(BaseModel):
    """Request model for creating a new user in a tenant."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    roles: list[str] = Field(default=["member"])

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ROLES
        if invalid:
            raise ValueError(f"Invalid roles: {invalid}. Valid roles: {VALID_ROLES}")
        return v


class UpdateUserRequest(BaseModel):
    """Request model for updating a user."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")


class AssignRolesRequest(BaseModel):
    """Request model for assigning roles to a user."""

    roles: list[str]

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ROLES
        if invalid:
            raise ValueError(f"Invalid roles: {invalid}. Valid roles: {VALID_ROLES}")
        return v


class UserResponse(BaseModel):
    """Response model for a user."""

    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    roles: list[str] = Field(default_factory=list)
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Response model for listing users with pagination."""

    data: list[UserResponse]
    total: int
    limit: int
    offset: int
