# Antibot Detection Engine (Minimal)

A production-ready backend for detecting bots and crawlers using a weighted scoring model. Implemented in Python/FastAPI with PostgreSQL (TimescaleDB) and Redis.

## Features

- **Risk Scoring**: Weighted model combining IP reputation, user-agent analysis, request patterns, etc.
- **Rule Engine**: Configurable rules with actions: allow, rate-limit, challenge (PoW), block.
- **Allowlist/Denylist**: CIDR-based lists with optional TTL.
- **Proof-of-Work**: Challenge/response to deter bots without blocking legitimate users.
- **Admin API**: Manage rules, lists, tokens, view metrics and logs.
- **Observability**: Real-time metrics and searchable request logs.
- **Dockerized**: Easy local dev and production deployment.

## Architecture

```
┌─────────────┐   /evaluate   ┌─────────────────────┐
│   Proxy/    │──────────────▶│ Detection Engine    │
│   Client    │               │ (FastAPI)           │
└─────────────┘               └─────────┬───────────┘                                        │
                                     │
                              ┌──────▼──────┐
                              │ PostgreSQL │
                              │ (Timescale)│
                              └────────────┘
```

## Quick Start (Docker Compose)

```bash
cd backend_minimal
docker-compose up --build
```

This starts:
- PostgreSQL + TimescaleDB on `localhost:5432`
- Redis on `localhost:6379`
- Detection Engine on `http://localhost:8000`

### Initialize Database

Run migrations and seed data:

```bash
# Enter the detection-engine container
docker-compose exec detection-engine bash

# Inside container, run:
psql -h postgres -U postgres -d antibot -f database/migrations/V1__initial_schema.sql
psql -h postgres -U postgres -d antibot -f database/seeds/01_default_data.sql
```

Alternatively, you can mount the SQL files and run them from your host using `psql`.

### Verify

```bash
# Health check
curl http://localhost:8000/admin/health

# Evaluate a request (example)
curl -X POST http://localhost:8000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0 ...",
    "path": "/",
    "method": "GET",
    "headers": {}
  }'
```

Response:

```json
{
  "score": 0,
  "verdict": "allow",
  "rule_triggers": []
}
```

If score >= 51 and < 81, you'll get a `challenge` verdict with PoW details.

## Admin API

All admin endpoints require a bearer token in the `Authorization` header.

Default dev token: `dev-admin-token` (configure via `API_TOKEN` env var).

### Endpoints

- `GET /admin/health` - service health
- `GET /admin/metrics/overview` - recent RPS and verdict percentages
- `GET /admin/metrics/top-offenders?limit=10` - top IPs by request volume
- `GET /admin/logs?start=...&end=...&ip=...&limit=100` - search logs
- `GET/POST/PUT/DELETE /admin/rules` - rule CRUD
- `GET/POST/DELETE /admin/allowlist` - allowlist management (CIDR)
- `GET/POST/DELETE /admin/denylist` - denylist management
- `POST /admin/tokens/generate` - create new admin tokens
- `GET/PUT /admin/settings` - view/update configuration

## Configuration

Environment variables (can be set in docker-compose or `.env`):

- `DB_URL` - PostgreSQL async connection string (default: `postgresql+asyncpg://postgres:postgres@postgres:5432/antibot`)
- `REDIS_URL` - Redis connection (default: `redis://redis:6379/0`)
- `API_TOKEN` - admin token for API (default: `dev-admin-token`)
- `HOST`, `PORT` - server bind address (default: `0.0.0.0:8000`)
- `SCORING_THRESHOLDS` - JSON with `low`, `medium`, `high` thresholds
- `WEIGHTS` - JSON mapping of category weights (must sum to 100)
- `RATE_LIMIT_BURST` - max requests per key before 429 (default 20)
- `POW_INITIAL_BITS` - PoW difficulty bits (default 18)

## Database Schema

Key tables:

- `request_logs`: all evaluations
- `rules`: detection rules
- `allowlist` / `denylist`: CIDR-based exceptions
- `api_tokens`: hashed admin tokens
- `audit_log`: admin action history
- `metrics`: rollup statistics (TimescaleDB hypertable)
- `settings`: global configuration

## Scoring Model (ADR-001)

Categories and default weights:

| Category          | Weight |
|-------------------|--------|
| IP Reputation     | 30%    |
| User-Agent        | 20%    |
| Request Pattern   | 20%    |
| Behavioral        | 15%    |
| TLS Fingerprint   | 10%    |
| Headless Detection| 5%     |

Thresholds:

- 0-20: Allow
- 21-50: Rate Limit
- 51-80: Challenge (PoW)
- 81-100: Block

## Rules

Rules are stored in the database and can be managed via the admin API. Default rules include:

- Block IPs from external blocklists (risk >= 0.8)
- Block denylisted IPs (hard block)
- Allow allowlisted IPs (force 0 score)
- Block known bot user-agents
- Rate limit missing User-Agent
- Rate limit excessive requests
- Challenge repeated admin endpoint access

## Proof-of-Work

When verdict is `challenge`, the response includes:

```json
{
  "challenge": {
    "type": "pow",
    "bits": 18,
    "nonce": "abc123...",
    "algorithm": "sha256"
  }
}
```

Client must compute a hashcash-like solution and submit to `/verify-pow`:

```json
{
  "challenge_nonce": "abc123...",
  "answer": "client_nonce"
}
```

If valid, the request can be retried with the proof.

## Production Considerations

- Use a process manager (e.g., systemd, supervisord) or orchestrate with Kubernetes.
- Enable TLS termination at a reverse proxy (NGINX, Traefik).
- Use strong random `API_TOKEN` and restrict admin endpoints via network or VPN.
- Set up regular backups for PostgreSQL.
- Consider Redis cluster for high volume rate limiting.
- Monitor resource usage and set up alerts.
- Adjust weights and thresholds based on observed traffic.
- Implement proper authentication for admin UI (separate from token-based API).
- Consider using NGINX/OpenResty for edge-rate limiting in addition to this service.

## Development

```bash
# Create virtualenv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run locally with DB/Redis running
uvicorn app.main:app --reload
```

## License

MIT
