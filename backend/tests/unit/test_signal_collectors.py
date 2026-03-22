"""
Unit tests for Signal Collectors.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.signal_collectors import SignalCollector

pytestmark = pytest.mark.unit

class TestSignalCollector:
    """Tests for the SignalCollector class."""

    @pytest.mark.asyncio
    async def test_collect_ip_reputation_from_allowlist(self, db_session):
        """Test IP reputation collect checks allowlist."""
        # Arrange
        from app.models import Allowlist
        allow_entry = Allowlist(ip="192.0.2.1", reason="test")
        db_session.add(allow_entry)
        await db_session.commit()

        collector = SignalCollector(db_session)
        request_data = {
            "ip": "192.0.2.1",
            "user_agent": "test",
            "path": "/",
            "method": "GET",
            "headers": {}
        }

        # Act
        signals = await collector.collect(request_data)

        # Assert
        assert signals["ip_rep"]["allowlist"] is True

    @pytest.mark.asyncio
    async def test_collect_ip_reputation_from_denylist(self, db_session):
        """Test IP reputation collect checks denylist."""
        from app.models import Denylist
        deny_entry = Denylist(ip="203.0.113.5", reason="bad")
        db_session.add(deny_entry)
        await db_session.commit()

        collector = SignalCollector(db_session)
        request_data = {
            "ip": "203.0.113.5",
            "user_agent": "test",
            "path": "/",
            "method": "GET",
            "headers": {}
        }

        signals = await collector.collect(request_data)
        assert signals["ip_rep"]["denylist"] is True

    @pytest.mark.asyncio
    async def test_collect_user_agent_missing(self, db_session):
        """Test user agent signal when UA is missing."""
        collector = SignalCollector(db_session)
        request_data = {
            "ip": "1.2.3.4",
            "user_agent": None,
            "path": "/",
            "method": "GET",
            "headers": {}
        }

        signals = await collector.collect(request_data)
        assert signals["user_agent"]["missing"] is True

    @pytest.mark.asyncio
    async def test_collect_user_agent_present(self, db_session):
        """Test user agent signal when UA is provided."""
        collector = SignalCollector(db_session)
        request_data = {
            "ip": "1.2.3.4",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "path": "/",
            "method": "GET",
            "headers": {}
        }

        signals = await collector.collect(request_data)
        assert signals["user_agent"]["missing"] is False
        assert signals["user_agent"]["value"] == "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

    @pytest.mark.asyncio
    async def test_collect_request_pattern_rate_limit(self, db_session):
        """Test request pattern rate limiting."""
        collector = SignalCollector(db_session)
        # We need to seed the rate limit counter for this IP+UA combo
        # The collector's _get_rate_limit_counter should fetch from DB
        request_data = {
            "ip": "10.0.0.1",
            "user_agent": "TestAgent",
            "path": "/test",
            "method": "POST",
            "headers": {}
        }

        # Initially, no counter, so should be 0 and not rate_limited
        signals = await collector.collect(request_data)
        assert "rate_limited" in signals["request_pattern"]
        # By default, rate_limited is False if count below threshold

    @pytest.mark.asyncio
    async def test_collect_includes_tls_and_behavioral(self, db_session):
        """Test that TLS and behavioral signals are included (even if None)."""
        collector = SignalCollector(db_session)
        request_data = {
            "ip": "1.2.3.4",
            "user_agent": "test",
            "path": "/",
            "method": "GET",
            "headers": {},
            "tls_ja3": "some_ja3_hash"
        }

        signals = await collector.collect(request_data)
        assert "tls" in signals
        assert signals["tls"]["ja3"] == "some_ja3_hash"
        assert "behavioral" in signals  # empty for now
