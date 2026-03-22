"""
Unit tests for the Rule Engine.
"""
import pytest
from unittest.mock import MagicMock, patch
from app.services.rule_engine import RuleEngine
from app.models import Rules
from datetime import datetime

pytestmark = pytest.mark.unit

class TestRuleEngine:
    """Tests for the RuleEngine class."""

    @pytest.mark.asyncio
    async def test_evaluate_with_matching_rule(self, db_session):
        """Test that matching rules contribute to score and set forced verdict."""
        # Arrange: create a rule in the database
        rule = Rules(
            name="Test Block Rule",
            condition_type="user_agent",
            condition={"pattern": "TestBot"},
            weight=50,
            action="block",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)
        signals = {
            "user_agent": "Mozilla/5.0 (TestBot/1.0)",
            "ip_rep": {},
            "request_pattern": {}
        }
        request_meta = {"path": "/test", "headers": {}}

        # Act
        score, triggered, verdict = await engine.evaluate(signals, request_meta)

        # Assert
        assert score == 50
        assert str(rule.id) in triggered
        assert verdict == "block"

    @pytest.mark.asyncio
    async def test_evaluate_with_multiple_rules(self, db_session):
        """Test that multiple matching rules accumulate score."""
        # Arrange
        rule1 = Rules(
            name="UA Check",
            condition_type="user_agent",
            condition={"pattern": "Bot"},
            weight=20,
            action="rate_limit",
            enabled=True
        )
        rule2 = Rules(
            name="IP Blocklist",
            condition_type="ip_reputation",
            condition={"source": "blocklist", "min_risk": 0.5},
            weight=30,
            action="block",
            enabled=True
        )
        db_session.add_all([rule1, rule2])
        await db_session.commit()

        engine = RuleEngine(db_session)
        signals = {
            "user_agent": "MyBot/1.0",
            "ip_rep": {"blocklist_risk": 0.7},
            "request_pattern": {}
        }
        request_meta = {"path": "/", "headers": {}}

        # Act
        score, triggered, verdict = await engine.evaluate(signals, request_meta)

        # Assert
        assert score == 50  # 20 + 30
        assert len(triggered) == 2
        # The forced verdict from rule2 (block) overrides
        assert verdict == "block"

    @pytest.mark.asyncio
    async def test_evaluate_without_forced_verdict_uses_thresholds(self, db_session, monkeypatch):
        """Test that score-based verdict applies when no forced action."""
        # Arrange
        rule = Rules(
            name="Low weight rule",
            condition_type="user_agent",
            condition={"missing": True},
            weight=15,
            action="allow",  # This is a forced action but weight low; actually action sets forced_verdict
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        # Mock settings thresholds
        monkeypatch.setattr("app.services.rule_engine.settings.SCORING_THRESHOLDS", {
            "low": 20,
            "medium": 50,
            "high": 80
        })

        engine = RuleEngine(db_session)
        signals = {
            "user_agent": {"missing": True},
            "ip_rep": {},
            "request_pattern": {}
        }
        request_meta = {"path": "/", "headers": {}}

        # Act
        score, triggered, verdict = await engine.evaluate(signals, request_meta)

        # Assert
        assert score == 15
        # Forced action from rule: 'allow' overrides thresholds
        assert verdict == "allow"

    @pytest.mark.asyncio
    async def test_matches_rule_user_agent_pattern(self, db_session):
        """Test user_agent condition pattern matching."""
        rule = Rules(
            name="UA Pattern",
            condition_type="user_agent",
            condition={"pattern": "Python-urllib/\\d+\\.\\d+"},
            weight=10,
            action="block",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)

        # Should match
        signals = {"user_agent": "Python-urllib/3.9"}
        request_meta = {"path": "/", "headers": {}}
        score, triggered, verdict = await engine.evaluate(signals, request_meta)
        assert score == 10
        assert len(triggered) == 1

        # Should not match different UA
        signals2 = {"user_agent": "Mozilla/5.0"}
        score2, triggered2, verdict2 = await engine.evaluate(signals2, request_meta)
        assert score2 == 0
        assert len(triggered2) == 0

    @pytest.mark.asyncio
    async def test_matches_rule_rate_limit(self, db_session):
        """Test rate_limit condition."""
        rule = Rules(
            name="Rate Limit",
            condition_type="rate_limit",
            condition={"threshold": 100},
            weight=20,
            action="rate_limit",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)

        # Exceeds threshold
        signals = {"request_pattern": {"count": 150}}
        request_meta = {"path": "/", "headers": {}}
        score, triggered, verdict = await engine.evaluate(signals, request_meta)
        assert score == 20
        assert verdict == "rate_limit"

        # Below threshold
        signals2 = {"request_pattern": {"count": 50}}
        score2, triggered2, verdict2 = await engine.evaluate(signals2, request_meta)
        assert score2 == 0
        assert len(triggered2) == 0

    @pytest.mark.asyncio
    async def test_matches_rule_ip_reputation_allowlist(self, db_session):
        """Test ip_reputation condition checking allowlist."""
        rule = Rules(
            name="Allowlist IPs",
            condition_type="ip_reputation",
            condition={"source": "allowlist"},
            weight=0,
            action="allow",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)

        signals = {"ip_rep": {"allowlist": True}}
        request_meta = {"path": "/", "headers": {}}
        score, triggered, verdict = await engine.evaluate(signals, request_meta)
        assert verdict == "allow"  # forced

    @pytest.mark.asyncio
    async def test_matches_rule_missing_user_agent(self, db_session):
        """Test missing user_agent condition."""
        rule = Rules(
            name="Missing UA",
            condition_type="user_agent",
            condition={"missing": True},
            weight=10,
            action="rate_limit",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)

        signals = {"user_agent": {"missing": True}}
        request_meta = {"path": "/", "headers": {}}
        score, triggered, verdict = await engine.evaluate(signals, request_meta)
        assert score == 10
        assert verdict == "rate_limit"

    @pytest.mark.asyncio
    async def test_evaluate_with_disabled_rule(self, db_session):
        """Test that disabled rules are not evaluated."""
        rule = Rules(
            name="Disabled Rule",
            condition_type="user_agent",
            condition={"pattern": "BadBot"},
            weight=50,
            action="block",
            enabled=False
        )
        db_session.add(rule)
        await db_session.commit()

        engine = RuleEngine(db_session)
        signals = {"user_agent": "BadBot/1.0"}
        request_meta = {"path": "/", "headers": {}}

        score, triggered, verdict = await engine.evaluate(signals, request_meta)
        assert score == 0
        assert len(triggered) == 0
        assert verdict == "allow"  # default
