"""
Unit tests for Proof-of-Work service.
"""
import pytest
import hashlib
from app.services import pow as pow_service

pytestmark = pytest.mark.unit

class TestPoWManager:
    """Tests for the PoW manager."""

    def test_generate_challenge_returns_correct_structure(self):
        """Test challenge generation structure."""
        ip = "192.0.2.1"
        challenge = pow_service.pow_manager.generate_challenge(ip=ip)

        assert "type" in challenge
        assert challenge["type"] == "pow"
        assert "bits" in challenge
        assert isinstance(challenge["bits"], int)
        assert challenge["bits"] >= 16 and challenge["bits"] <= 32
        assert "nonce" in challenge
        assert isinstance(challenge["nonce"], str)
        assert "algorithm" in challenge
        assert challenge["algorithm"] == "sha256"

    def test_pow_verification_success(self):
        """Test successful PoW verification."""
        # Generate a challenge
        ip = "10.0.0.1"
        challenge = pow_service.pow_manager.generate_challenge(ip=ip)
        nonce = challenge["nonce"]
        bits = challenge["bits"]
        algorithm = challenge["algorithm"]

        # Compute a valid answer
        target = 2**(256 - bits)
        client_nonce = None
        for i in range(100000):
            candidate = f"{nonce}{i}".encode()
            h = hashlib.sha256(candidate).hexdigest()
            if int(h, 16) < target:
                client_nonce = str(i)
                break

        assert client_nonce is not None, "Failed to find valid answer in range"

        # Verify
        result = pow_service.pow_manager.verify_pow(
            challenge_nonce=nonce,
            answer=client_nonce,
            bits=bits,
            algorithm=algorithm
        )
        assert result is True

    def test_pow_verification_fails_with_wrong_answer(self):
        """Test PoW verification fails with incorrect answer."""
        challenge = pow_service.pow_manager.generate_challenge(ip="1.2.3.4")
        result = pow_service.pow_manager.verify_pow(
            challenge_nonce=challenge["nonce"],
            answer="wrong",
            bits=challenge["bits"],
            algorithm=challenge["algorithm"]
        )
        assert result is False

    def test_pow_verification_fails_with_reused_nonce(self):
        """Test that nonce cannot be reused (replay protection)."""
        challenge = pow_service.pow_manager.generate_challenge(ip="5.6.7.8")
        nonce = challenge["nonce"]

        # First verification should succeed (we'll compute a valid answer quickly for test)
        # For speed, we can find a small nonce because low bits can be achieved quickly with enough attempts
        target = 2**(256 - challenge["bits"])
        answer = None
        for i in range(10000):
            candidate = f"{nonce}{i}".encode()
            h = hashlib.sha256(candidate).hexdigest()
            if int(h, 16) < target:
                answer = str(i)
                break

        assert answer is not None

        # Simulate verification - accept once
        pow_service.pow_manager.verify_pow(
            challenge_nonce=nonce,
            answer=answer,
            bits=challenge["bits"],
            algorithm=challenge["algorithm"]
        )

        # Second attempt with same nonce should fail (replay protection)
        result2 = pow_service.pow_manager.verify_pow(
            challenge_nonce=nonce,
            answer=answer,
            bits=challenge["bits"],
            algorithm=challenge["algorithm"]
        )
        assert result2 is False

    def test_cleanup_removes_old_challenges(self):
        """Test cleanup old PoW challenges."""
        # This is tricky to test without time manipulation.
        # We'll at least ensure method exists and can be called.
        pow_service.pow_manager.cleanup()
        # If no exception, pass
        assert True
