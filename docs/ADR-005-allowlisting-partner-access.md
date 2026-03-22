# ADR-005: Allowlisting & Partner Access

## Status
Accepted

## Context
Legitimate partners (e.g., search engines, API clients) and internal services need guaranteed access without being blocked by the antibot system. We must manage these exceptions securely and scalably.

## Decision
Implement **multi-factor allowlisting** combining IP, API tokens, and optional mTLS.

### Allowlist Types

1. **IP-based**
   - Single IP or CIDR range.
   - Automatic bypass: all risk scores set to 0, no rate limiting.
   - Managed via admin API or dashboard.

2. **API Token**
   - Bearer token issued to partners.
   - Token includes:
     - `sub` (partner identifier)
     - `scope` (e.g., `read:metrics`, `write:rules`)
     - `exp`
     - `rate_limit` (override default)
   - Verified by API gateway before request reaches detection engine.

3. **mTLS Client Cert**
   - For high-trust internal services.
   - Client must present certificate signed by our CA.
   - Bypass all checks.

### API Token Issuance

- Admin creates token via dashboard or `POST /admin/tokens`.
- Token stored hashed in DB (`api_tokens` table).
- Token can be revoked (deleted) at any time.

### Rate Limit Overrides

- Allowlisted tokens can have custom limits (e.g., 1000 RPS).
- Configured per-token in `rate_limit_override` field.

### Audit Trail

- All allowlist modifications logged to `audit_log`.
- Token usage logs include `token_id` (not the token itself) for traceability.

### Partner Self-Service (Optional)

- Partners can manage their tokens via a restricted portal (separate auth).
- Can rotate tokens, view usage metrics.

### Security

- API tokens transmitted only over HTTPS.
- Token entropy: 256-bit random (base64url).
- Rotate tokens every 90 days (configurable).

## Consequences
- Legitimate traffic unaffected.
- Scalable management via API and dashboard.
- Auditable and revocable access.
