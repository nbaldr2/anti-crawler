# System Design: Antibot/Anti-Crawler Protection with Dashboard

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Clients / Traffic                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Reverse Proxy (NGINX/OpenResty)                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Lua/JS module extracts request metadata (IP, UA, headers, TLS)    │   │
│   │  Forwards to Detection Engine via gRPC/HTTP internally              │   │
│   │  Receives verdict (allow/rate-limit/challenge/block)               │   │
│   │  Enforces: forward, add 429, return 403, or send challenge header  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ gRPC/HTTP (localhost)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Detection Engine (Python/FastAPI)                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  - Loads rules from PostgreSQL                                     │   │
│   │  - Collects signals (IP reputation, UA, TLS, behavioral)          │   │
│   │  - Computes risk score (0-100)                                     │   │
│   │  - Returns verdict + risk score                                    │   │
│   │  - Logs decision to PostgreSQL                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ SQL
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (+ TimescaleDB)                          │
│   Tables: request_logs, rules, allowlist, denylist, metrics, api_tokens    │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Pub/Sub + REST
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Dashboard (React + WebSocket)                     │
│   - Real-time charts (RPS, block rate, top IPs)                            │
│   - Rule management UI                                                     │
│   - Allow/Deny list management                                             │
│   - Search and drill-down logs                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Component Design

### 2.1 Reverse Proxy (NGINX/OpenResty)

- **Module**: Lua (`ngx_http_lua`) or njs.
- **Responsibilities**:
  - Accept HTTPS traffic (TLS termination).
  - Extract request metadata: `remote_addr`, `http_user_agent`, headers, JA3 fingerprint (via `ssl_fingerprint` variable).
  - Call detection engine via `grpc` or `http` with keepalive.
  - Apply verdict:
    - `allow` → proxy_pass to backend.
    - `rate_limit` → `limit_req` zone.
    - `challenge` → add `X-Challenge` header and return 403.
    - `block` → return 403.
  - Log decisions to access log (JSON format).

- **Configuration**: Reloadable without downtime.

### 2.2 Detection Engine (Python/FastAPI)

- **Framework**: FastAPI (async) or Go for performance.
- **Endpoints**:
  - `POST /evaluate` – receives request metadata, returns `{score, verdict, rule_triggers}`.
  - `POST /verify-pow` – validates proof-of-work.
  - `GET /health` – health check.
- **Signal Collectors** (pluggable):
  - `IPReputation`: query PostgreSQL blocklist tables.
  - `UserAgent`: check against known bot list, heuristics (missing, uncommon patterns).
  - `TLSFingerprint`: compare JA3 hash to known bot fingerprints.
  - `Behavioral`: (optional) client-side JS sends signals via separate endpoint.
  - `RequestPattern`: in-memory sliding window counters for rate limiting and sequencing.
- **Rules Engine**: Evaluate loaded rules in order; stop on hard block.
- **Caching**: Redis cache for IP reputation results (TTL 1h).

### 2.3 Dashboard

- **Framework**: React 18 + TypeScript + Vite.
- **State Management**: Redux Toolkit or Zustand.
- **Charts**: Recharts or ECharts.
- **WebSocket**: Native WebSocket to receive real-time updates (RPS, blocks).
- **API Client**: Axios/Fetch with token auth.
- **Pages**: Overview, Traffic Search, Rules, Allow/Deny Lists, Settings.

## 3. Database Schema (PostgreSQL)

### request_logs

```sql
CREATE TABLE request_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip INET NOT NULL,
    user_agent TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    risk_score SMALLINT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('allow','rate_limit','challenge','block')),
    rule_triggers JSONB, -- array of rule IDs that fired
    metadata JSONB, -- TLS fingerprint, behavioral signals, etc.
    ip_hash CHAR(64) -- SHA256 hash of IP for pseudonymized storage after 30d
);
-- Indexes
CREATE INDEX idx_request_logs_timestamp ON request_logs (timestamp);
CREATE INDEX idx_request_logs_ip_hash ON request_logs (ip_hash) WHERE ip_hash IS NOT NULL;
```

### rules

```sql
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('ip_reputation','user_agent','header','rate_limit','tls','custom')),
    condition JSONB NOT NULL, -- e.g., {"field":"user_agent","pattern":"Python-urllib"}
    weight SMALLINT NOT NULL CHECK (weight BETWEEN 0 AND 100),
    action TEXT NOT NULL CHECK (action IN ('allow','rate_limit','block','challenge')),
    threshold_override JSONB, -- optional score threshold to override
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### allowlist / denylist

```sql
CREATE TABLE allowlist (
    id BIGSERIAL PRIMARY KEY,
    ip CIDR NOT NULL UNIQUE,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE denylist (
    id BIGSERIAL PRIMARY KEY,
    ip CIDR NOT NULL UNIQUE,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### api_tokens

```sql
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash CHAR(64) NOT NULL UNIQUE, -- SHA256 of token
    sub TEXT NOT NULL,
    scope JSONB NOT NULL, -- array of strings
    rate_limit_override INT, -- requests per minute
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### audit_log

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL, -- admin user or system
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    details JSONB
);
```

### metrics (TimescaleDB hypertable)

```sql
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rps INT NOT NULL,
    block_count INT NOT NULL,
    challenge_count INT NOT NULL,
    allow_count INT NOT NULL,
    top_offenders JSONB -- array of {ip, count}
);
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 hour');
```

## 4. API Specification

### Authentication
All admin/API endpoints require `Authorization: Bearer <token>` with valid admin token.

### Detection Engine Endpoints (internal, not exposed externally)

- `POST /evaluate` (gRPC or HTTP)
  ```json
  {
    "ip": "203.0.113.5",
    "user_agent": "Mozilla/5.0 ...",
    "headers": {"accept":"text/html", ...},
    "tls_ja3": "...",
    "path": "/login",
    "method": "POST",
    "body_hash": "sha256:..."
  }
  ```
  Response:
  ```json
  {
    "score": 67,
    "verdict": "challenge",
    "rule_triggers": ["rule-ua-bot","rate-limit"],
    "challenge": {"type":"pow","bits":18,"nonce":"abc123"}
  }
  ```

- `POST /verify-pow`
  ```json
  {"challenge_nonce":"abc123","answer":"0000f5a2..."}
  ```
  Response: `{"valid": true}`

### Admin Dashboard API (external, behind auth)

- `GET /api/metrics/overview` → `{rps, allow_percent, block_percent, challenge_percent}` (last 1m)
- `GET /api/metrics/top-offenders?limit=5` → `[{ip, count}, ...]` (last 1h)
- `GET /api/logs?start=...&end=...&ip=...&limit=100&offset=0` → paginated logs
- `GET /api/rules` / `POST /api/rules` / `PUT /api/rules/{id}` / `DELETE /api/rules/{id}`
- `GET /api/allowlist` / `POST /api/allowlist` / `DELETE /api/allowlist/{id}`
- `GET /api/denylist` / `POST /api/denylist` / `DELETE /api/denylist/{id}`
- `POST /api/tokens/generate` → `{token, expires_at, scope}` (plain token shown once)
- `GET /api/settings` / `PUT /api/settings` – adjust thresholds, weights.

## 5. Deployment Guide

### Prerequisites

- Linux server (Ubuntu 22.04+)
- Docker & Docker Compose (optional) or native installs
- Domain name with TLS certificate (Let's Encrypt)

### Services

| Service | Container/Image | Ports | Replicas |
|---------|----------------|-------|----------|
| NGINX + Lua | custom | 80,443 | 2+ (behind LB) |
| Detection Engine | Python:3.11-slim | 8000 (internal) | 3+ |
| PostgreSQL | timescale/timescaledb:latest | 5432 (internal) | 1 (with streaming replica) |
| Redis | redis:7-alpine | 6379 (internal) | 1 |
| Dashboard | Node.js build + Nginx | 3000 (internal) → 443 (subpath /dashboard) | 2+ |

### Production Recommendations

- Use a cloud load balancer (HAProxy, AWS ALB) in front of NGINX proxies.
- Enable TLS 1.3, strong ciphers; OCSP stapling.
- PostgreSQL: daily backups, WAL archiving, point-in-time recovery.
- Redis: AOF persistence, replica for HA.
- Monitoring: Prometheus + Grafana for infrastructure metrics.
- Logging: JSON logs to stdout; collect with Loki or ELK.
- Secrets: Vault or Docker secrets; never in repo.

### Scaling

- Horizontal: add more proxy and engine replicas; use consistent hashing for IP-based stickiness if needed for rate limiter state.
- Database: read replicas for dashboard queries; connection pooler (PgBouncer).
- Redis: cluster mode for larger datasets.

## 6. Tech Stack

| Layer | Technology | Alternatives |
|-------|------------|--------------|
| Reverse Proxy | NGINX + OpenResty (Lua) | Envoy (Lua/Wasm) |
| Detection Engine | Python/FastAPI (async) | Go (Gin/Echo) |
| DB | PostgreSQL 15 + TimescaleDB | InfluxDB, ClickHouse |
| Cache | Redis | Memcached |
| Dashboard | React + TypeScript + Vite | Vue 3, SvelteKit |
| Charts | ECharts | Recharts, Chart.js |
| Auth | JWT (HS256) | OAuth2/OIDC |
| Deployment | Docker Compose / Kubernetes | Nomad, systemd |
| CI/CD | GitHub Actions / GitLab CI | Jenkins, ArgoCD |

## 7. Security Considerations

- All external comms over HTTPS with valid certs.
- Admin API tokens stored hashed (SHA256).
- Rate limiting also on admin endpoints to prevent brute force.
- Regular security scans (SAST, DAST) in CI.
- Keep dependencies updated; use Dependabot/Renovate.
- Penetration testing before production launch.

## 8. Open Questions

- Behavioral signal collection: require client JS snippet; need to design non-blocking integration.
- TLS fingerprinting: requires JA3 collection; may need OpenSSL patch or external library.
- Headless detection: maintain list of headless indicators; update frequency.

---

This design fulfills the requirements for a scalable, real-time antibot protection system with a comprehensive dashboard.
