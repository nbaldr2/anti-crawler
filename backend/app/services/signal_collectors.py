# Services: signal collectors
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models import Allowlist, Denylist, IpBlocklist, UserAgentBlocklist, RateLimitCounters
from ..config import settings
import ipaddress
import re
import hashlib
from datetime import datetime, timedelta

# Optional Redis
try:
    import aioredis
    redis = None
except ImportError:
    aioredis = None
    redis = None

async def get_redis():
    global redis
    if redis is None and aioredis:
        redis = await aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return redis

class IPReputation:
    @staticmethod
    async def is_allowlisted(ip_str: str, db: AsyncSession) -> bool:
        ip_obj = ipaddress.ip_address(ip_str)
        stmt = select(Allowlist).where(Allowlist.expires_at.is_(None) | (Allowlist.expires_at > datetime.utcnow()))
        result = await db.execute(stmt)
        allowlists = result.scalars().all()
        for al in allowlists:
            net = ipaddress.ip_network(al.ip, strict=False)
            if ip_obj in net:
                return True
        return False

    @staticmethod
    async def is_denylisted(ip_str: str, db: AsyncSession) -> bool:
        ip_obj = ipaddress.ip_address(ip_str)
        stmt = select(Denylist).where(Denylist.expires_at.is_(None) | (Denylist.expires_at > datetime.utcnow()))
        result = await db.execute(stmt)
        denylists = result.scalars().all()
        for dl in denylists:
            net = ipaddress.ip_network(dl.ip, strict=False)
            if ip_obj in net:
                return True
        return False

    @staticmethod
    async def get_blocklist_risk(ip_str: str, db: AsyncSession) -> Optional[float]:
        stmt = select(IpBlocklist.risk_score).where(IpBlocklist.ip == ip_str)
        result = await db.execute(stmt)
        risk = result.scalar_one_or_none()
        return risk

class UserAgentChecker:
    @staticmethod
    async def is_bot(user_agent: Optional[str], db: AsyncSession) -> bool:
        if not user_agent:
            return True
        stmt = select(UserAgentBlocklist).where(UserAgentBlocklist.enabled == True)
        result = await db.execute(stmt)
        patterns = result.scalars().all()
        for p in patterns:
            try:
                if re.search(p.pattern, user_agent, re.IGNORECASE):
                    return True
            except re.error:
                if p.pattern.lower() in user_agent.lower():
                    return True
        return False

class RequestPatternLimiter:
    @staticmethod
    async def is_rate_limited(ip: str, user_agent: Optional[str], db: AsyncSession) -> (bool, int):
        ua_hash = hashlib.md5((user_agent or "").encode()).hexdigest()[:8]
        key = f"rl:{ip}:{ua_hash}"
        r = await get_redis()
        if r:
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, settings.RATE_LIMIT_KEY_TTL)
            if count > settings.RATE_LIMIT_BURST:
                return True, count
            return False, count
        else:
            # DB fallback
            now = datetime.utcnow()
            reset = now + timedelta(seconds=settings.RATE_LIMIT_KEY_TTL)
            stmt = select(RateLimitCounters).where(RateLimitCounters.key == key)
            result = await db.execute(stmt)
            entry = result.scalar_one_or_none()
            if entry:
                if entry.reset_time < now:
                    entry.count = 1
                    entry.reset_time = reset
                else:
                    entry.count += 1
                    if entry.count > settings.RATE_LIMIT_BURST:
                        return True, entry.count
            else:
                entry = RateLimitCounters(key=key, count=1, reset_time=reset)
                db.add(entry)
            return False, entry.count

class SignalCollector:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def collect(self, req: Dict[str, Any]) -> Dict[str, Any]:
        ip = req['ip']
        user_agent = req.get('user_agent')
        signals = {}

        # IP
        if await IPReputation.is_allowlisted(ip, self.db):
            signals['ip_rep'] = {'allowlist': True, 'denylist': False, 'blocklist_risk': None}
        else:
            signals['ip_rep'] = {
                'allowlist': False,
                'denylist': await IPReputation.is_denylisted(ip, self.db),
                'blocklist_risk': await IPReputation.get_blocklist_risk(ip, self.db)
            }

        # UA
        signals['user_agent'] = {'missing': user_agent is None, 'is_bot': await UserAgentChecker.is_bot(user_agent, self.db)}

        # Rate limit
        rate_limited, count = await RequestPatternLimiter.is_rate_limited(ip, user_agent, self.db)
        signals['request_pattern'] = {'rate_limited': rate_limited, 'count': count}

        # Other signals (not fully implemented in iteration1)
        signals['tls'] = {'ja3': req.get('tls_ja3')}
        signals['behavioral'] = {}

        return signals
