# PoW verification endpoint (public, no admin token required)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas import VerifyPowRequest, VerifyPowResponse
from ..services import pow as pow_service

router = APIRouter()

@router.post("/verify-pow", response_model=VerifyPowResponse)
async def verify_pow(data: VerifyPowRequest):
    valid = pow_service.pow_manager.verify(data.challenge_nonce, data.answer)
    if valid:
        pow_service.pow_manager.consume(data.challenge_nonce)
    return VerifyPowResponse(valid=valid)
