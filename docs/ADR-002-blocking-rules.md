# ADR-002: Blocking Rules and Enforcement

## Status
Accepted

## Context
Once a risk score is computed, the system must enforce blocking decisions at the edge (reverse proxy). Blocking must be tiered, privacy-friendly, and include allowlisting capabilities.

## Decision
Implement **tiered enforcement** with soft and hard blocking, plus allowlist/denylist overrides.

### Enforcement Levels

1. **Allow** (score ≤ 20): Forward request normally.
2. **Rate Limit** (21-50): Apply per-IP/session throttling (e.g., 10 RPS). Exceeded requests return 429.
3. **Challenge** (51-80): Return 403 with `X-Challenge: pow` header indicating proof-of-work challenge. Client must compute a hashcash-like puzzle and retry with `X-Pow-Answer`.
4. **Block** (81-100): Immediate 403 with no challenge.

### Override Lists

- **Allowlist**: IPs or fingerprints that bypass all checks (score forced to 0). Stored in PostgreSQL, reloadable.
- **Denylist**: IPs or fingerprints that always block (score forced to 100). Hard block.

Lists can be managed via admin API and take effect immediately.

### Rate Limiting

- Implemented in the proxy layer (NGINX/OpenResty) using shared memory zones.
- Key: `IP + user_agent_hash` (to prevent UA rotation bypass).
- Burst capacity: 20 requests.
- Cleanup: idle entries expire after 60s.

### Proof-of-Work Challenge

- Server issues: `X-Challenge: sha256,<difficulty>,<nonce>`
- Client must find a number such that `SHA256(original_nonce + client_nonce) <= target`.
- Difficulty starts at 18 bits, increases for repeat offenders.
- Verified by detection engine endpoint `/verify-pow`.

### Privacy & Data Minimization

- No persistent cookies for tracking.
- Rate limiter keys are volatile (in-memory only).
- Logs are sanitized: IPs hashed after 24h unless flagged for investigation.

### Monitoring

- All decisions logged: IP, UA, score, rule triggers, enforcement action, timestamp.
- Dashboard displays real-time metrics: allowed %, blocked %, challenge rate, top offenders.

## Consequences
- Graduated response reduces false positives.
- Challenge deters automated tools without harming users.
- Allowlist/denylist provide operational flexibility.
