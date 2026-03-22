# Anti-Crawler Protection System

A production-ready, scalable system to detect and mitigate automated bots, scrapers, and crawlers while allowing legitimate traffic. Built with a modern stack and privacy-friendly design.

## Features

- **Multi-layered Detection**
  - Browser fingerprinting (UA, TLS/JA3, headless detection)
  - Behavioral analysis (request patterns, timing anomalies)
  - Rate limiting per IP/User-Agent
  - Proof-of-Work challenges for suspicious traffic
  - IP reputation from threat intelligence feeds

- **Tiered Enforcement**
  - Allow (trusted traffic)
  - Rate limit (burst protection)
  - Challenge (PoW for unknown bots)
  - Block (malicious sources)

- **Real-time Dashboard**
  - Live metrics (RPS, verdict distribution)
  - Searchable traffic logs with filters
  - Rules management with live testing
  - Allow/deny list management
  - Settings for thresholds and weights

- **Privacy & Compliance**
  - No CAPTCHA (use proof-of-work instead)
  - Data minimization (pseudonymization after 30d)
  - Configurable retention policies
  - Audit logs for admin actions

- **Scalable Architecture**
  - FastAPI async engine
  - PostgreSQL + TimescaleDB for metrics
  - Redis for rate limiting and caching
  - Docker Compose for local/staging
  - Kubernetes-ready manifests

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy async |
| Database | PostgreSQL 15 + TimescaleDB |
| Cache | Redis 7 |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Charts | Recharts |
| Tests | pytest, Vitest, Playwright |
| DevOps | Docker, Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend dev)
- Python 3.11+ (optional, for local backend dev)

### Start Full Stack

```bash
# Clone and enter
git clone git@github.com:nbaldr2/anti-crawler.git
cd anti-crawler

# Start all services (backend, frontend, DB, Redis)
docker-compose -f backend/docker-compose.yml up -d

# Initialize database (run once)
docker-compose -f backend/docker-compose.yml exec detection-engine \
  psql -h postgres -U postgres -d antibot -f database/migrations/V1__initial_schema.sql
docker-compose -f backend/docker-compose.yml exec detection-engine \
  psql -h postgres -U postgres -d antibot -f database/seeds/01_default_data.sql

# Access frontend: http://localhost:3000
# Access backend API: http://localhost:8000
# API docs (Swagger): http://localhost:8000/docs
```

### Default Admin Token

- Token: `dev-admin-token` (change in production!)
- Login at `http://localhost:3000/login`

## Project Structure

```
antibot-system/
├── backend/
│   ├── app/
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── main.py           # FastAPI app
│   ├── database/
│   │   ├── migrations/       # Schema migrations
│   │   └── seeds/            # Initial data
│   ├── tests/                # pytest suite
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API clients
│   │   └── pages/            # Route pages
│   ├── e2e/                  # Playwright E2E tests
│   ├── src/components/__tests__/  # Component tests
│   ├── Dockerfile
│   └── package.json
├── docs/
│   ├── ADR-*.md              # Architecture decision records
│   ├── system-design.md      # Full system design
│   ├── planning_antibot_protection_system.md
│   └── qa/                   # Test reports & instructions
├── data/
│   └── iteration1_signals.json  # Sample threat intel
└── docker-compose.test.yml   # Test orchestration
```

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/evaluate` | Evaluate a request, return score & verdict |
| GET | `/health` | Service health check |

### Admin Endpoints (Bearer Token required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/health` | Detailed health (DB, Redis) |
| POST | `/admin/rules` | Create a new rule |
| GET | `/admin/rules` | List all rules |
| PUT | `/admin/rules/{id}` | Update rule |
| DELETE | `/admin/rules/{id}` | Delete rule |
| POST | `/admin/allowlist` | Add allowlist entry |
| DELETE | `/admin/allowlist/{cidr}` | Remove allowlist entry |
| POST | `/admin/denylist` | Add denylist entry |
| DELETE | `/admin/denylist/{cidr}` | Remove denylist entry |
| POST | `/admin/tokens/generate` | Generate admin API token |
| GET | `/admin/metrics/overview` | Get RPS & verdict percentages |
| GET | `/admin/logs` | Search request logs (filterable) |
| GET/PUT | `/admin/settings` | Get/update system settings |

See `/backend/README.md` for full API schema and examples.

## Configuration

Backend settings (`app/config.py`):

```python
# Scoring thresholds (0-100)
SCORING_THRESHOLDS = {
    "low": 20,    # 0-19: allow
    "medium": 50, # 20-49: rate_limit
    "high": 80    # 50-79: challenge, 80-100: block
}

# Category weights (must sum to 100)
WEIGHTS = {
    "ip_reputation": 30,
    "user_agent": 20,
    "request_pattern": 20,
    "behavioral": 15,
    "tls_fingerprint": 10,
    "headless_detection": 5
}

# Rate limiting (token bucket)
RATE_LIMIT = {
    "burst": 20,
    "window_seconds": 60
}

# Proof-of-Work
POW = {
    "initial_bits": 16,      # Difficulty (16-32)
    "expiry_seconds": 3600   # Challenge expiry
}
```

Frontend environment (`.env`):

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Testing

### Backend

```bash
cd backend
pip install -r requirements.txt
pytest                    # all tests
pytest -m unit            # unit only
pytest -m integration     # integration only
pytest --cov=app          # with coverage
```

### Frontend

```bash
cd frontend
npm ci
npm run test              # Vitest component tests
npm run test:coverage
npm run e2e               # Playwright (requires stack running)
```

### Full Stack Integration

```bash
# From project root
docker-compose -f docker-compose.test.yml up --build tests
```

See `docs/qa/INSTRUCTIONS.md` for detailed test execution guide.

## Architecture Highlights

### Detection Model

Each request is evaluated by scoring signals across multiple categories:

1. **IP Reputation (30%)**: External blocklists, historical abuse
2. **User-Agent (20%)**: Known bots, missing UA, inconsistencies
3. **Request Patterns (20%)**: Rate limits, endpoint frequency
4. **Behavioral (15%)**: Mouse movements, timing (future)
5. **TLS Fingerprint (10%)**: JA3 hashes, cipher suites
6. **Headless Detection (5%)**: Navigator properties, WebGL

Rules can override scoring with forced actions (allow/rate_limit/challenge/block).

### Data Flow

```
Client → NGINX/OpenResty (proxy) → FastAPI Engine → DB/Redis → Verdict
                                    ↓
                              Request Log (TimescaleDB)
                                    ↓
                              Dashboard (WebSocket)
```

### Deployment Considerations

- Use environment variables for secrets (`DB_URL`, `REDIS_URL`, `API_TOKEN`)
- Enable HTTPS termination at proxy/load balancer
- Set up Prometheus metrics endpoint (`/metrics`) in production
- Configure log shipping to SIEM (JSON logs)
- Use managed PostgreSQL with automated backups
- Scale engine horizontally behind a load balancer (Redis shared)

## Security Notes

- Change the default `API_TOKEN` before deploying
- Use HTTPS in production
- Restrict admin endpoints to internal networks or VPN
- Enable RBAC for dashboard users (future work)
- Rotate GitHub tokens if using the GitHub Assistant skill
- Keep dependency versions updated

## Privacy

- Retain raw logs for 30 days (pseudonymized IPs after 30d)
- Aggregate metrics retained for 2 years
- No PII stored unless explicitly logged by user applications
- GDPR-ready: ability to delete logs on request

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`make test` or docker-compose.test.yml)
5. Submit a pull request

## License

MIT-0. See LICENSE file for details.

## Support

- Issues: https://github.com/nbaldr2/anti-crawler/issues
- Docs: See `docs/` directory for ADRs and system design
- OpenClaw: https://docs.openclaw.ai

---

**Built with OpenClaw multi-agent pipeline** 🦞