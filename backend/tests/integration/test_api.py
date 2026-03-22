"""
Integration tests for API endpoints.
"""
import pytest
from httpx import AsyncClient
from app.models import Rules, Allowlist, Denylist, ApiTokens
from sqlalchemy import select
import hashlib
import secrets

pytestmark = pytest.mark.integration

class TestEvaluateEndpoint:
    """Tests for POST /evaluate."""

    @pytest.mark.asyncio
    async def test_evaluate_valid_request_returns_score_and_verdict(self, client, db_session):
        """Test a basic evaluate request with no matching rules."""
        response = await client.post(
            "/evaluate",
            json={
                "ip": "1.2.3.4",
                "user_agent": "Mozilla/5.0",
                "path": "/test",
                "method": "GET",
                "headers": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "verdict" in data
        assert data["verdict"] in ["allow", "rate_limit", "challenge", "block"]
        assert 0 <= data["score"] <= 100

    @pytest.mark.asyncio
    async def test_evaluate_with_missing_ip_fails_validation(self, client):
        """Test that invalid IP returns 422."""
        response = await client.post(
            "/evaluate",
            json={
                "ip": "invalid-ip",
                "user_agent": "test",
                "path": "/",
                "method": "GET"
            }
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_evaluate_with_allowlist_bypass(self, client, db_session):
        """Test that IP in allowlist results in score=0 and verdict=allow."""
        from app.models import Allowlist
        allow = Allowlist(ip="5.5.5.5", reason="test")
        db_session.add(allow)
        await db_session.commit()

        response = await client.post(
            "/evaluate",
            json={
                "ip": "5.5.5.5",
                "user_agent": "any",
                "path": "/",
                "method": "GET"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 0
        assert data["verdict"] == "allow"

    @pytest.mark.asyncio
    async def test_evaluate_with_denylist_block(self, client, db_session):
        """Test that IP in denylist results in score=100 and verdict=block."""
        from app.models import Denylist
        deny = Denylist(ip="6.6.6.6", reason="malicious")
        db_session.add(deny)
        await db_session.commit()

        response = await client.post(
            "/evaluate",
            json={
                "ip": "6.6.6.6",
                "user_agent": "any",
                "path": "/",
                "method": "GET"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 100
        assert data["verdict"] == "block"

    @pytest.mark.asyncio
    async def test_evaluate_returns_challenge_if_score_in_challenge_range(self, client, db_session):
        """Test that high score returns a PoW challenge."""
        # Create a rule that adds weight to push score into challenge range (51-80)
        rule = Rules(
            name="High Score Rule",
            condition_type="user_agent",
            condition={"missing": True},
            weight=60,
            action="challenge",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        response = await client.post(
            "/evaluate",
            json={
                "ip": "7.7.7.7",
                "user_agent": None,
                "path": "/",
                "method": "GET"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["verdict"] == "challenge"
        assert "challenge" in data
        assert data["challenge"]["type"] == "pow"

    @pytest.mark.asyncio
    async def test_evaluate_logs_request(self, client, db_session):
        """Test that evaluate endpoint logs the request to database."""
        response = await client.post(
            "/evaluate",
            json={
                "ip": "8.8.8.8",
                "user_agent": "TestClient/1.0",
                "path": "/api/test",
                "method": "POST"
            }
        )
        assert response.status_code == 200

        # Check that log entry was created
        from app.models import RequestLogs
        result = await db_session.execute(
            select(RequestLogs).where(RequestLogs.ip == "8.8.8.8")
        )
        logs = result.scalars().all()
        assert len(logs) >= 1

    @pytest.mark.asyncio
    async def test_evaluate_rate_limit_triggered_by_signal(self, client, db_session):
        """Test that request pattern rate limit triggers verdict."""
        # The evaluate endpoint should also check the request pattern signal and enforce rate_limit.
        # We'll simulate by sending repeated requests? That's complex.
        # Instead, we'll rely on the condition_type=rate_limit rule.
        rule = Rules(
            name="Rate Limit Rule",
            condition_type="rate_limit",
            condition={"threshold": 0},  # any count > 0 triggers
            weight=0,
            action="rate_limit",
            enabled=True
        )
        db_session.add(rule)
        await db_session.commit()

        # Even a single request may be rate-limited based on the signal's count value.
        # However, the signal's count comes from the RateLimitCounters table.
        # We need to seed a counter for the IP+UA combo with a high count.
        from app.models import RateLimitCounters
        counter = RateLimitCounters(
            key="rate:8.8.8.8:TestAgent",
            count=150,
            reset_time="2099-01-01"  # far future
        )
        db_session.add(counter)
        await db_session.commit()

        response = await client.post(
            "/evaluate",
            json={
                "ip": "8.8.8.8",
                "user_agent": "TestAgent",
                "path": "/",
                "method": "GET"
            }
        )
        # Expect rate limit because signal's count > threshold (0) and verdict not already block/challenge
        data = response.json()
        assert data["verdict"] == "rate_limit"


class TestAdminEndpoints:
    """Tests for admin API."""

    ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token"}

    @pytest.mark.asyncio
    async def test_admin_health_check(self, client, db_session):
        """Test /admin/health returns status."""
        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "database" in data
        assert "redis" in data

    @pytest.mark.asyncio
    async def test_admin_rules_crud(self, client, db_session, sample_rule_data):
        """Test CRUD operations on rules."""
        # Create
        response = await client.post(
            "/admin/rules",
            json=sample_rule_data,
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 201
        rule = response.json()
        rule_id = rule["id"]

        # Read
        response = await client.get(f"/admin/rules/{rule_id}")
        assert response.status_code == 200
        assert response.json()["name"] == sample_rule_data["name"]

        # Update
        update_data = {"description": "Updated description"}
        response = await client.put(
            f"/admin/rules/{rule_id}",
            json=update_data,
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description"

        # Delete
        response = await client.delete(f"/admin/rules/{rule_id}", headers=self.ADMIN_HEADERS)
        assert response.status_code == 204

        # Confirm deleted
        response = await client.get(f"/admin/rules/{rule_id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_admin_rules_requires_auth(self, client, sample_rule_data):
        """Test that admin rules endpoints require authentication."""
        response = await client.post("/admin/rules", json=sample_rule_data)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_allowlist_crud(self, client, db_session):
        """Test CRUD on allowlist."""
        # Add
        response = await client.post(
            "/admin/allowlist",
            json={"ip": "192.0.2.0/24", "reason": "test"},
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 201

        # List
        response = await client.get("/admin/allowlist", headers=self.ADMIN_HEADERS)
        assert response.status_code == 200
        allowlist = response.json()
        assert len(allowlist) >= 1
        assert any(entry["ip"] == "192.0.2.0/24" for entry in allowlist)

        # Remove
        response = await client.delete(
            "/admin/allowlist/192.0.2.0/24",
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200

        # Confirm removed
        response = await client.get("/admin/allowlist", headers=self.ADMIN_HEADERS)
        allowlist = response.json()
        assert not any(entry["ip"] == "192.0.2.0/24" for entry in allowlist)

    @pytest.mark.asyncio
    async def test_admin_denylist_crud(self, client, db_session):
        """Test CRUD on denylist."""
        response = await client.post(
            "/admin/denylist",
            json={"ip": "203.0.113.0/24", "reason": "bad range"},
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 201

        response = await client.get("/admin/denylist", headers=self.ADMIN_HEADERS)
        assert response.status_code == 200
        denylist = response.json()
        assert any(entry["ip"] == "203.0.113.0/24" for entry in denylist)

        response = await client.delete(
            "/admin/denylist/203.0.113.0/24",
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_token_generation(self, client, db_session):
        """Test token generation creates hashed token in DB."""
        response = await client.post(
            "/admin/tokens/generate",
            json={
                "sub": "partner-1",
                "scope": ["read:metrics", "write:rules"],
                "rate_limit_override": 500,
                "expires_in_days": 30
            },
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200
        token_data = response.json()
        assert "token" in token_data
        assert len(token_data["token"]) > 30
        assert token_data["sub"] == "partner-1"

        # Verify token hash stored
        token_hash = hashlib.sha256(token_data["token"].encode()).hexdigest()
        result = await db_session.execute(
            select(ApiTokens).where(ApiTokens.token_hash == token_hash)
        )
        token_entry = result.scalar_one_or_none()
        assert token_entry is not None
        assert token_entry.sub == "partner-1"

    @pytest.mark.asyncio
    async def test_admin_metrics_overview(self, client, db_session):
        """Test metrics overview endpoint."""
        response = await client.get("/admin/metrics/overview", headers=self.ADMIN_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert "rps" in data
        assert "allow_percent" in data
        assert "block_percent" in data
        assert "challenge_percent" in data

    @pytest.mark.asyncio
    async def test_admin_logs_search(self, client, db_session):
        """Test logs search with filters."""
        # First, generate some logs by making evaluate calls
        await client.post("/evaluate", json={
            "ip": "9.9.9.9",
            "path": "/test",
            "method": "GET"
        })

        response = await client.get(
            "/admin/logs?ip=9.9.9.9&limit=10",
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_settings_update(self, client, db_session):
        """Test settings update."""
        response = await client.put(
            "/admin/settings",
            json={
                "scoring_thresholds": {"low": 15, "medium": 45, "high": 75}
            },
            headers=self.ADMIN_HEADERS
        )
        assert response.status_code == 200

        # Get to confirm
        response = await client.get("/admin/settings", headers=self.ADMIN_HEADERS)
        assert response.status_code == 200
        settings = response.json()
        assert "scoring_thresholds" in settings

    @pytest.mark.asyncio
    async def test_admin_endpoints_unauthorized_with_invalid_token(self, client):
        """Test admin endpoints reject invalid token."""
        response = await client.get("/admin/metrics/overview", headers={"Authorization": "Bearer wrong"})
        assert response.status_code == 401
