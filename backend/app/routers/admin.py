# Admin API endpoints
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func, text
from typing import List, Optional
from datetime import datetime, timedelta
from ipaddress import ip_network
from ..config import settings
from ..database import get_db
from ..schemas import (
    RuleCreate, RuleUpdate, RuleResponse,
    AllowlistItem, DenylistItem,
    TokenGenerateRequest, TokenResponse,
    MetricsOverview, TopOffender, LogEntry, LogSearchResponse,
    SettingsUpdate, HealthResponse
)
from ..models import (
    Rules, Allowlist, Denylist, ApiTokens, RequestLogs, AuditLog, Settings as SettingsModel
)
import hashlib
import secrets

router = APIRouter(prefix="/admin", tags=["admin"])

def _check_admin_token(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or auth.split(" ")[1] != settings.API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

async def _audit(db: AsyncSession, actor: str, action: str, resource_type: str, resource_id: str, details: dict = None):
    audit = AuditLog(actor=actor, action=action, resource_type=resource_type, resource_id=str(resource_id), details=details)
    db.add(audit)
    await db.flush()

# Health
@router.get("/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)):
    # Check DB
    try:
        await db.execute(select(1))
        db_status = "ok"
    except Exception:
        db_status = "error"
    # Check Redis (optional)
    try:
        from ..services.signal_collectors import get_redis
        r = await get_redis()
        if r:
            await r.ping()
            redis_status = "ok"
        else:
            redis_status = "unavailable"
    except Exception:
        redis_status = "error"
    return HealthResponse(status="ok", database=db_status, redis=redis_status)

# Metrics overview (computed from request_logs last 1 minute)
@router.get("/metrics/overview", response_model=MetricsOverview)
async def metrics_overview(db: AsyncSession = Depends(get_db)):
    one_min_ago = datetime.utcnow() - timedelta(minutes=1)
    stmt = select(
        func.count().label('total'),
        func.sum(func.case((RequestLogs.verdict == 'allow', 1), else_=0)).label('allow_count'),
        func.sum(func.case((RequestLogs.verdict == 'block', 1), else_=0)).label('block_count'),
        func.sum(func.case((RequestLogs.verdict == 'challenge', 1), else_=0)).label('challenge_count'),
    ).where(RequestLogs.timestamp >= one_min_ago)
    result = await db.execute(stmt)
    row = result.one_or_none()
    total = row.total or 0
    allow = row.allow_count or 0
    block = row.block_count or 0
    challenge = row.challenge_count or 0
    rps = total  # per minute? Actually per second? We computed last minute's total; RPS = total/60? Better to approximate as per minute count. We'll return per minute count as rps? The design expects instantaneous RPS. For simplicity, we compute average per second over last minute.
    rps = round(total / 60, 2) if total else 0
    allow_percent = (allow / total * 100) if total else 0
    block_percent = (block / total * 100) if total else 0
    challenge_percent = (challenge / total * 100) if total else 0
    return MetricsOverview(rps=rps, allow_percent=allow_percent, block_percent=block_percent, challenge_percent=challenge_percent)

# Top offenders (last hour)
@router.get("/metrics/top-offenders", response_model=TopOffendersResponse)
async def top_offenders(limit: int = Query(10, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    stmt = select(
        RequestLogs.ip,
        func.count().label('cnt')
    ).where(RequestLogs.timestamp >= one_hour_ago)\
     .group_by(RequestLogs.ip)\
     .order_by(text('cnt DESC'))\
     .limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    offenders = [TopOffender(ip=str(row.ip), count=row.cnt) for row in rows]
    return TopOffendersResponse(offenders=offenders)

# Log search
@router.get("/logs", response_model=LogSearchResponse)
async def search_logs(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    ip: Optional[str] = None,
    verdict: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RequestLogs).order_by(RequestLogs.timestamp.desc())
    if start:
        stmt = stmt.where(RequestLogs.timestamp >= start)
    if end:
        stmt = stmt.where(RequestLogs.timestamp <= end)
    if ip:
        stmt = stmt.where(RequestLogs.ip == ip)
    if verdict:
        stmt = stmt.where(RequestLogs.verdict == verdict)
    # total count (could be separate query but we can use window)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    # paginate
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    entries = [
        LogEntry(
            id=log.id,
            timestamp=log.timestamp,
            ip=str(log.ip),
            user_agent=log.user_agent,
            endpoint=log.endpoint,
            method=log.method,
            risk_score=log.risk_score,
            verdict=log.verdict,
            rule_triggers=log.rule_triggers or [],
            metadata=log.metadata or {}
        ) for log in logs
    ]
    return LogSearchResponse(total=total, logs=entries, next_offset=offset+limit if offset+limit < total else None)

# Rules CRUD
@router.get("/rules", response_model=List[RuleResponse])
async def list_rules(db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Rules)
    result = await db.execute(stmt)
    rules = result.scalars().all()
    return rules

@router.post("/rules", response_model=RuleResponse, status_code=201)
async def create_rule(rule: RuleCreate, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    new_rule = Rules(**rule.dict())
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    # audit
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="create", resource_type="rule", resource_id=str(new_rule.id))
    await db.commit()
    return new_rule

@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(rule_id: str, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Rules).where(Rules.id == rule_id)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.put("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(rule_id: str, rule_update: RuleUpdate, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Rules).where(Rules.id == rule_id)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    update_data = rule_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    rule.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rule)
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="update", resource_type="rule", resource_id=str(rule_id))
    await db.commit()
    return rule

@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Rules).where(Rules.id == rule_id)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="delete", resource_type="rule", resource_id=str(rule_id))
    await db.commit()
    return None

# Allowlist
@router.get("/allowlist", response_model=List[AllowlistItem])
async def list_allowlist(db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Allowlist)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [AllowlistItem(ip=str(e.ip), reason=e.reason, expires_at=e.expires_at) for e in entries]

@router.post("/allowlist", status_code=201)
async def add_allowlist(item: AllowlistItem, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    try:
        net = ip_network(item.ip, strict=False)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid CIDR")
    entry = Allowlist(ip=net, reason=item.reason, expires_at=item.expires_at, created_by='admin')
    db.add(entry)
    await db.commit()
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="add", resource_type="allowlist", resource_id=item.ip)
    await db.commit()
    return {"message": "Added"}

@router.delete("/allowlist/{cidr}")
async def remove_allowlist(cidr: str, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = delete(Allowlist).where(Allowlist.ip == cidr)
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="remove", resource_type="allowlist", resource_id=cidr)
    await db.commit()
    return {"message": "Removed"}

# Denylist
@router.get("/denylist", response_model=List[DenylistItem])
async def list_denylist(db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(Denylist)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [DenylistItem(ip=str(e.ip), reason=e.reason, expires_at=e.expires_at) for e in entries]

@router.post("/denylist", status_code=201)
async def add_denylist(item: DenylistItem, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    try:
        net = ip_network(item.ip, strict=False)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid CIDR")
    entry = Denylist(ip=net, reason=item.reason, expires_at=item.expires_at, created_by='admin')
    db.add(entry)
    await db.commit()
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="add", resource_type="denylist", resource_id=item.ip)
    await db.commit()
    return {"message": "Added"}

@router.delete("/denylist/{cidr}")
async def remove_denylist(cidr: str, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = delete(Denylist).where(Denylist.ip == cidr)
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="remove", resource_type="denylist", resource_id=cidr)
    await db.commit()
    return {"message": "Removed"}

# Token generation
@router.post("/tokens/generate", response_model=TokenResponse)
async def generate_token(token_req: TokenGenerateRequest, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    # Generate a random token
    plain_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(days=token_req.expires_in_days) if token_req.expires_in_days else None
    token_entry = ApiTokens(
        token_hash=token_hash,
        sub=token_req.sub,
        scope=token_req.scope,
        rate_limit_override=token_req.rate_limit_override,
        expires_at=expires_at
    )
    db.add(token_entry)
    await db.commit()
    await db.refresh(token_entry)
    # Return plain token once
    return TokenResponse(
        token=plain_token,
        token_id=str(token_entry.id),
        sub=token_req.sub,
        scope=token_req.scope,
        expires_at=token_entry.expires_at or datetime.utcnow()
    )

# Settings GET/PUT
@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    stmt = select(SettingsModel)
    result = await db.execute(stmt)
    settings_rows = result.scalars().all()
    return {row.key: row.value for row in settings_rows}

@router.put("/settings")
async def update_settings(update: SettingsUpdate, db: AsyncSession = Depends(get_db), request: Request = None):
    _check_admin_token(request)
    # Update provided keys
    for key, value in update.dict(exclude_unset=True).items():
        stmt = select(SettingsModel).where(SettingsModel.key == key)
        result = await db.execute(stmt)
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
            setting.updated_at = datetime.utcnow()
        else:
            setting = SettingsModel(key=key, value=value)
            db.add(setting)
    await db.commit()
    await _audit(db, actor=request.headers.get("Authorization", "").split(" ")[1], action="update", resource_type="settings", resource_id="global")
    await db.commit()
    return {"message": "Settings updated"}
