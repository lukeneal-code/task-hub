from fastapi import APIRouter
from app import database as db

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "admin-service"}


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies database connectivity."""
    checks = {"database": False}

    try:
        result = await db.fetchval("SELECT 1")
        checks["database"] = result == 1
    except Exception:
        checks["database"] = False

    all_healthy = all(checks.values())

    return {
        "status": "ready" if all_healthy else "not_ready",
        "checks": checks,
    }
