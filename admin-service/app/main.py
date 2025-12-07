from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app import database as db
from app.api.health import router as health_router
from app.api.tenants import router as tenants_router
from app.api.users import router as users_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    logger.info("Starting admin-service...")
    await db.init_pool()
    logger.info("Admin service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down admin-service...")
    await db.close_pool()
    logger.info("Admin service shut down")


app = FastAPI(
    title="TaskHub Admin Service",
    description="Tenant provisioning and user management API",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [origin.strip() for origin in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(tenants_router, prefix="/api")
app.include_router(users_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "TaskHub Admin Service",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )
