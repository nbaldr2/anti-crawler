# Test Suite Documentation

This directory contains the comprehensive test suite for the Antibot System.

## Structure

```
qa-agent/
├── TEST_REPORT.md               # Detailed test report
├── docker-compose.test.yml      # Orchestration for backend tests
├── README.md                    # This file
├── INSTRUCTIONS.md              # Step-by-step test execution guide
└── ... (memory, etc.)
backend_minimal/
├── tests/
│   ├── conftest.py              # Pytest fixtures
│   ├── unit/
│   │   ├── test_rule_engine.py
│   │   ├── test_signal_collectors.py
│   │   └── test_pow.py
│   └── integration/
│       ├── test_api.py
│       └── test_bot_simulation.py
└── Dockerfile.test              # Test runner image
frontend/
├── src/components/__tests__/
│   ├── Overview.test.tsx
│   ├── TrafficDrillDown.test.tsx
│   ├── RulesManagement.test.tsx
│   ├── AllowDenyLists.test.tsx
│   └── Settings.test.tsx
├── e2e/
│   └── dashboard.spec.ts
├── vitest.config.ts
└── playwright.config.ts
```

## Running Tests

### Backend

#### Local (postgres running on localhost:5432)

```bash
cd /root/.openclaw/workspace-backend-dev/workspace/backend_minimal

# Install deps
pip install -r requirements.txt

# Create test database (once)
createdb antibot_test  # or via SQL

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run unit only
pytest -m unit

# Run integration only
pytest -m integration

# Verbose
pytest -v
```

#### With Docker Compose

```bash
cd /root/.openclaw/workspace-qa-agent
docker-compose -f docker-compose.test.yml up --build tests
```

This will start postgres, run tests inside the `tests` service, and output reports to the container. To persist reports, mount a volume for `/reports`.

### Frontend

#### Unit/Component Tests

```bash
cd /root/.openclaw/workspace-frontend-dev/frontend
npm ci
npm run test
npm run test:coverage
```

#### E2E Tests

```bash
# Install browsers
npm run e2e:install

# Start backend and frontend (in separate terminals)
# Backend
cd /root/.openclaw/workspace-backend-dev/workspace/backend_minimal
docker-compose up -d

# Frontend
cd /root/.openclaw/workspace-frontend-dev/frontend
npm run dev

# Then in another terminal from frontend dir:
npm run e2e
```

E2E tests will open a Chromium browser and perform actions against the running frontend at `http://localhost:3000`.

---

## Notes

- Backend tests use a dedicated test database `antibot_test`. Ensure it exists and is accessible.
- Backend fixtures automatically create/drop tables per test session.
- Admin token for API tests: `test-admin-token` (configured in conftest).
- PoW tests may take a few seconds to find a valid nonce.
- Frontend tests are synchronous and run in jsdom.
- E2E tests assume the Login page accepts any token (for test environment). In production, token validation occurs via backend call.

---

## Coverage Goals

- Backend: >90% for rule_engine, signal_collectors, evaluate endpoint
- Frontend: >80% for component rendering and interactions
- E2E: cover critical user journeys

---

## Troubleshooting

**Backend: `asyncpg` import errors**
Make sure `psycopg2-binary` is installed and libpq is available.

**Frontend: module resolution errors**
Ensure `tsconfig.json` includes `"paths"` for `@/*` or adjust the Vitest config accordingly.

**Playwright: browsers missing**
Run `npm run e2e:install` in the frontend directory.

**Docker: tests container exits immediately**
Check test logs: `docker-compose -f docker-compose.test.yml logs tests`.

---

Last updated: 2026-03-21
