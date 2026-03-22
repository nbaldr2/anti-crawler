# Main FastAPI application
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn
from .database import engine, Base, get_db, AsyncSessionLocal
from .config import settings
from .routers import evaluate, verify_pow, health, admin
from .services import pow as pow_service
import asyncio
from sqlalchemy import text

app = FastAPI(title="Antibot Detection Engine", version="1.0.0")

# Include routers
app.include_router(evaluate.router)
app.include_router(verify_pow.router)
app.include_router(health.router)
app.include_router(admin.router)

@app.on_event("startup")
async def startup():
    # Create tables if they don't exist (for dev). In production, run migrations.
    async with engine.begin() as conn:
        #await conn.run_sync(Base.metadata.create_all)
        pass  # Skip auto-create; rely on migrations

    # Start background cleanup task for PoW and rate limit counters
    asyncio.create_task(cleanup_task())

async def cleanup_task():
    """Periodically cleanup old PoW challenges and rate limit counters."""
    while True:
        await asyncio.sleep(300)  # every 5 minutes
        try:
            pow_service.pow_manager.cleanup()
            # Optionally call DB function to cleanup rate limit counters
            from .database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                await db.execute(text("SELECT cleanup_rate_limit_counters()"))
                await db.commit()
        except Exception as e:
            print(f"Cleanup error: {e}")

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
