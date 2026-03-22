# Evaluate endpoint
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from ..database import get_db
from ..schemas import EvaluateRequest, EvaluateResponse
from ..services.signal_collectors import SignalCollector
from ..services.rule_engine import RuleEngine
from ..services import pow as pow_service
from ..models import RequestLogs
from sqlalchemy import insert

router = APIRouter()

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(request: EvaluateRequest, db: AsyncSession = Depends(get_db)):
    req_data = request.dict()
    collector = SignalCollector(db)
    engine = RuleEngine(db)

    signals = await collector.collect(req_data)
    score, triggered, verdict = await engine.evaluate(signals, req_data)

    # Override from allowlist/denylist
    if signals['ip_rep'].get('allowlist'):
        score = 0
        verdict = 'allow'
        triggered = []
    if signals['ip_rep'].get('denylist'):
        score = 100
        verdict = 'block'

    # If rate limited by signal, enforce rate_limit verdict (unless already harder)
    if signals['request_pattern'].get('rate_limited') and verdict not in ('block', 'challenge'):
        verdict = 'rate_limit'

    response = EvaluateResponse(score=score, verdict=verdict, rule_triggers=triggered)

    if verdict == 'challenge':
        challenge = pow_service.pow_manager.generate_challenge(ip=request.ip)
        response.challenge = challenge

    # Log asynchronously (fire and forget)
    log_entry = {
        'ip': request.ip,
        'user_agent': request.user_agent,
        'endpoint': request.path,
        'method': request.method,
        'risk_score': score,
        'verdict': verdict,
        'rule_triggers': triggered,
        'metadata': {
            'signals': signals,
            'tls_ja3': request.tls_ja3,
        }
    }
    async with db.begin():
        stmt = insert(RequestLogs).values(**log_entry)
        await db.execute(stmt)

    return response
