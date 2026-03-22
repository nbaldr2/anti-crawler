# Proof-of-Work manager
import hashlib
import secrets
from typing import Dict, Any
from datetime import datetime, timedelta
from ..config import settings

class PoWManager:
    def __init__(self):
        self.pending = {}  # nonce -> {server_nonce, bits, created_at, attempts, ip}
        self.used_nonces = set()

    def generate_challenge(self, ip: str = None) -> Dict[str, Any]:
        bits = settings.POW_INITIAL_BITS
        challenge_nonce = secrets.token_hex(8)
        server_nonce = secrets.token_hex(8)
        self.pending[challenge_nonce] = {
            'server_nonce': server_nonce,
            'bits': bits,
            'created_at': datetime.utcnow(),
            'attempts': 0,
            'ip': ip,
        }
        return {
            'type': 'pow',
            'bits': bits,
            'nonce': challenge_nonce,
            'algorithm': 'sha256',
        }

    def verify(self, challenge_nonce: str, answer: str) -> bool:
        if challenge_nonce not in self.pending:
            return False
        challenge = self.pending[challenge_nonce]
        if challenge['attempts'] >= settings.POW_MAX_ATTEMPTS:
            return False
        server_nonce = challenge['server_nonce']
        combined = (server_nonce + answer).encode('utf-8')
        h = hashlib.sha256(combined).hexdigest()
        bits = challenge['bits']
        # Check leading zero bits
        if bits % 4 == 0:
            required_zeros = bits // 4
            return h.startswith('0' * required_zeros)
        else:
            target = 2 ** (256 - bits)
            return int(h, 16) < target

    def consume(self, challenge_nonce: str):
        if challenge_nonce in self.pending:
            del self.pending[challenge_nonce]

    def cleanup(self):
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=settings.POW_WINDOW_SECONDS)
        to_delete = [k for k, v in self.pending.items() if v['created_at'] < cutoff]
        for k in to_delete:
            del self.pending[k]

# Global instance
pow_manager = PoWManager()
