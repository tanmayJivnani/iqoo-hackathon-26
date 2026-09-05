import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import init_db
from app.api.v1.endpoints.complaints import router as complaints_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Phone-first automated tree grievance classification, routing under Maharashtra Tree Act 1975, and photo-based civic re-verification."
)

# CORS middleware for mobile client & web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to initialize DB tables
@app.on_event("startup")
async def on_startup():
    os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    await init_db()

# Mount API routes
app.include_router(complaints_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }
