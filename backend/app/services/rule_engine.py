# Rule Engine
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from ..models import Rules
from ..config import settings

class RuleEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def evaluate(self, signals: Dict[str, Any], request_meta: Dict[str, Any]) -> (int, List[str], str):
        stmt = select(Rules).where(Rules.enabled == True)
        result = await self.db.execute(stmt)
        rules = result.scalars().all()

        total_score = 0
        triggered = []
        forced_verdict = None

        for rule in rules:
            if self._matches_rule(rule, signals, request_meta):
                triggered.append(str(rule.id))
                total_score += rule.weight
                # Hard actions without threshold override set forced verdict
                if rule.action in ('allow', 'block', 'rate_limit', 'challenge') and rule.threshold_override is None:
                    forced_verdict = rule.action

        total_score = min(100, max(0, total_score))
        verdict = self._determine_verdict(total_score, forced_verdict)
        return total_score, triggered, verdict

    def _matches_rule(self, rule: Rules, signals: Dict[str, Any], request_meta: Dict[str, Any]) -> bool:
        cond = rule.condition
        ctype = rule.condition_type

        if ctype == 'ip_reputation':
            source = cond.get('source')
            if source == 'allowlist':
                return signals['ip_rep'].get('allowlist', False)
            elif source == 'denylist':
                return signals['ip_rep'].get('denylist', False)
            elif source == 'blocklist':
                min_risk = cond.get('min_risk', 0)
                blocklist_risk = signals['ip_rep'].get('blocklist_risk')
                return blocklist_risk is not None and blocklist_risk >= min_risk

        elif ctype == 'user_agent':
            if cond.get('missing'):
                return signals['user_agent'].get('missing', False)
            pattern = cond.get('pattern')
            ua = signals['user_agent']
            if not ua:
                return False
            try:
                if re.search(pattern, ua, re.IGNORECASE):
                    return True
            except re.error:
                pass
            if pattern.lower() in ua.lower():
                return True
            return False

        elif ctype == 'rate_limit':
            threshold = cond.get('threshold', 100)
            count = signals['request_pattern'].get('count', 0)
            return count > threshold

        elif ctype == 'request_pattern':
            prefix = cond.get('endpoint_prefix')
            threshold = cond.get('threshold', 20)
            count = signals['request_pattern'].get('count', 0)
            if prefix and request_meta.get('path', '').startswith(prefix) and count > threshold:
                return True
            return False

        elif ctype == 'header':
            header_name = cond.get('header')
            header_value = request_meta.get('headers', {}).get(header_name)
            if header_value:
                pattern = cond.get('pattern')
                if pattern and re.search(pattern, header_value, re.IGNORECASE):
                    return True
            return False

        # custom not implemented
        return False

    def _determine_verdict(self, score: int, forced_verdict: Optional[str] = None) -> str:
        if forced_verdict:
            return forced_verdict
        thresholds = settings.SCORING_THRESHOLDS
        if score <= thresholds['low']:
            return 'allow'
        elif score <= thresholds['medium']:
            return 'rate_limit'
        elif score <= thresholds['high']:
            return 'challenge'
        else:
            return 'block'
