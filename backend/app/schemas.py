# Pydantic schemas
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# Evaluate
class EvaluateRequest(BaseModel):
    ip: str
    user_agent: Optional[str] = None
    headers: Optional[Dict[str, str]] = {}
    tls_ja3: Optional[str] = None
    path: str
    method: str
    body_hash: Optional[str] = None

    @validator('ip')
    def validate_ip(cls, v):
        import ipaddress
        try:
            ipaddress.ip_address(v)
        except ValueError:
            raise ValueError('Invalid IP address')
        return v

class EvaluateResponse(BaseModel):
    score: int = Field(..., ge=0, le=100)
    verdict: str
    rule_triggers: List[str] = []
    challenge: Optional[Dict[str, Any]] = None

# PoW
class VerifyPowRequest(BaseModel):
    challenge_nonce: str
    answer: str

class VerifyPowResponse(BaseModel):
    valid: bool

# Rules
class RuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    condition_type: str
    condition: Dict[str, Any]
    weight: int = Field(..., ge=0, le=100)
    action: str
    threshold_override: Optional[Dict[str, int]] = None
    enabled: bool = True

class RuleCreate(RuleBase):
    pass

class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_type: Optional[str] = None
    condition: Optional[Dict[str, Any]] = None
    weight: Optional[int] = Field(None, ge=0, le=100)
    action: Optional[str] = None
    threshold_override: Optional[Dict[str, int]] = None
    enabled: Optional[bool] = None

class RuleResponse(RuleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Allowlist/Denylist
class AllowlistItem(BaseModel):
    ip: str
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None

class DenylistItem(BaseModel):
    ip: str
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None

# Tokens
class TokenGenerateRequest(BaseModel):
    sub: str
    scope: List[str]
    rate_limit_override: Optional[int] = None
    expires_in_days: Optional[int] = 90

class TokenResponse(BaseModel):
    token: str
    token_id: str
    sub: str
    scope: List[str]
    expires_at: datetime

# Metrics
class MetricsOverview(BaseModel):
    rps: int
    allow_percent: float
    block_percent: float
    challenge_percent: float

class TopOffender(BaseModel):
    ip: str
    count: int

class TopOffendersResponse(BaseModel):
    offenders: List[TopOffender]

# Log entry
class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    ip: str
    user_agent: Optional[str] = None
    endpoint: str
    method: str
    risk_score: int
    verdict: str
    rule_triggers: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class LogSearchResponse(BaseModel):
    total: int
    logs: List[LogEntry]
    next_offset: Optional[int] = None

# Settings
class SettingsUpdate(BaseModel):
    scoring_thresholds: Optional[Dict[str, int]] = None
    weights: Optional[Dict[str, int]] = None
    rate_limit: Optional[Dict[str, Any]] = None
    pow: Optional[Dict[str, int]] = None

# Health
class HealthResponse(BaseModel):
    status: str = "ok"
    database: str
    redis: str
