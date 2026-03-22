# SQLAlchemy models
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, JSON, Float, ForeignKey, Index, BigInteger
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, CIDR, TIMESTAMPTZ
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import uuid

class Allowlist(Base):
    __tablename__ = "allowlist"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(CIDR, nullable=False, unique=True)
    reason = Column(Text, nullable=True)
    expires_at = Column(TIMESTAMPTZ, nullable=True)
    created_by = Column(String, nullable=False, default='system')
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

class Denylist(Base):
    __tablename__ = "denylist"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(CIDR, nullable=False, unique=True)
    reason = Column(Text, nullable=True)
    expires_at = Column(TIMESTAMPTZ, nullable=True)
    created_by = Column(String, nullable=False, default='system')
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

class ApiTokens(Base):
    __tablename__ = "api_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash = Column(String(64), nullable=False, unique=True)
    sub = Column(String, nullable=False)
    scope = Column(JSONB, nullable=False)
    rate_limit_override = Column(Integer, nullable=True)
    expires_at = Column(TIMESTAMPTZ, nullable=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

class Rules(Base):
    __tablename__ = "rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    condition_type = Column(String, nullable=False)
    condition = Column(JSONB, nullable=False)
    weight = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    threshold_override = Column(JSONB, nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        Index('idx_rules_enabled', 'enabled', postgresql_where=(enabled == True)),
    )

class RequestLogs(Base):
    __tablename__ = "request_logs"
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(TIMESTAMPTZ, server_default=func.now(), nullable=False)
    ip = Column(INET, nullable=False)
    user_agent = Column(Text, nullable=True)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    risk_score = Column(Integer, nullable=False)
    verdict = Column(String, nullable=False)
    rule_triggers = Column(JSONB, nullable=True)
    metadata = Column(JSONB, nullable=True)
    ip_hash = Column(String(64), nullable=True)
    __table_args__ = (
        Index('idx_request_logs_timestamp', 'timestamp', desc=True),
        Index('idx_request_logs_ip_hash', 'ip_hash', postgresql_where=(ip_hash.isnot(None))),
        Index('idx_request_logs_verdict', 'verdict'),
    )

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(TIMESTAMPTZ, server_default=func.now(), nullable=False)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    details = Column(JSONB, nullable=True)
    __table_args__ = (
        Index('idx_audit_log_timestamp', 'timestamp', desc=True),
    )

class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())

class Metrics(Base):
    __tablename__ = "metrics"
    time = Column(TIMESTAMPTZ, server_default=func.now(), nullable=False, primary_key=True)
    rps = Column(Integer, nullable=False)
    block_count = Column(Integer, nullable=False)
    challenge_count = Column(Integer, nullable=False)
    allow_count = Column(Integer, nullable=False)
    top_offenders = Column(JSONB, nullable=True)

class RateLimitCounters(Base):
    __tablename__ = "rate_limit_counters"
    key = Column(String, primary_key=True)
    count = Column(Integer, default=1, nullable=False)
    reset_time = Column(TIMESTAMPTZ, nullable=False)

class IpBlocklist(Base):
    __tablename__ = "ip_blocklist"
    id = Column(BigInteger, primary_key=True, index=True)
    ip = Column(INET, nullable=False)
    source_url = Column(String, nullable=False)
    category = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False)
    scraped_at = Column(TIMESTAMPTZ, server_default=func.now())
    __table_args__ = (
        Index('idx_ip_blocklist_ip', 'ip'),
        UniqueConstraint('ip', 'source_url', name='uq_ip_source'),
    )

class UserAgentBlocklist(Base):
    __tablename__ = "user_agent_blocklist"
    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    risk_score = Column(Float, default=0.7, nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
