# Health check endpoint (public)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..schemas import HealthResponse
from ..services.signal_collectors import get_redis
import asyncio

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)):
    # Check DB
    try:
        await db.execute(select(1))
        db_status = "ok"
    except Exception:
        db_status = "error"
    # Check Redis
    try:
        r = await get_redis()
        if r:
            await r.ping()
            redis_status = "ok"
        else:
            redis_status = "unavailable"
    except Exception:
        redis_status = "error"
    return HealthResponse(status="ok", database=db_status, redis=redis_status)
