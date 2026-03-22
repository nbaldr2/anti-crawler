# Instructions for Reproducible Test Runs

This document provides step-by-step instructions to run the full test suite for the Antibot System.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend tests)
- Python 3.11+ (for backend tests, optional if using Docker)
- PostgreSQL 15 (if running tests locally without Docker)

---

## Option 1: Docker Compose (Recommended for Full Stack)

This option uses Docker Compose to start all services and run tests in an isolated environment.

### Steps

1. **Prepare the environment**

```bash
# Ensure you are in the qa-agent workspace
cd /root/.openclaw/workspace-qa-agent
```

2. **Start the full stack (backend, frontend, postgres, redis)**

   The backend and frontend services are defined in their respective docker-compose files. For testing, we only need the backend database. The qa-agent's `docker-compose.test.yml` will start postgres and run tests against the engine.

3. **Run backend tests only (via tests service)**

```bash
docker-compose -f docker-compose.test.yml up --build tests
```

   - This will:
     - Build the `backend_minimal` image (if not exists)
     - Start postgres
     - Create the test database (via command in tests service)
     - Run pytest
     - Output test results to stdout

   - To generate coverage and JUnit XML reports, mount a volume:

     Edit `docker-compose.test.yml` to add a volume mount to the tests service:

     ```yaml
     volumes:
       - ./reports:/reports
     ```

     Then the pytest command already outputs to `/reports/backend-tests.xml` and coverage to `/reports/coverage.xml`.

4. **Run frontend unit/component tests**

```bash
cd /root/.openclaw/workspace-frontend-dev/frontend
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm ci && npm run test -- --reporter=json > /dev/stdout"
```

   Or simply:

```bash
npm ci
npm run test
```

5. **Run E2E tests**

   E2E tests require a running frontend and backend.

   a. Start backend:

```bash
cd /root/.openclaw/workspace-backend-dev/workspace/backend_minimal
docker-compose up -d
```

   b. Initialize DB (if needed):

```bash
docker-compose exec detection-engine bash -c "
  psql -h postgres -U postgres -d antibot -f database/migrations/V1__initial_schema.sql &&
  psql -h postgres -U postgres -d antibot -f database/seeds/01_default_data.sql
"
```

   c. Start frontend:

```bash
cd /root/.openclaw/workspace-frontend-dev/frontend
npm install
npm run dev
```

   d. In another terminal, run e2e:

```bash
cd /root/.openclaw/workspace-frontend-dev/frontend
npm run e2e:install   # once
npm run e2e
```

---

## Option 2: Local Development without Docker (Backend Only)

If you have a local PostgreSQL instance.

1. **Create test database**

```bash
psql -U postgres -c "CREATE DATABASE antibot_test;"
psql -U postgres -c "CREATE USER testuser WITH PASSWORD 'testpass';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE antibot_test TO testuser;"
```

2. **Set environment variable**

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://testuser:testpass@localhost:5432/antibot_test"
```

3. **Install dependencies**

```bash
cd /root/.openclaw/workspace-backend-dev/workspace/backend_minimal
pip install -r requirements.txt
```

4. **Run tests**

```bash
pytest
```

5. **Frontend local**

```bash
cd /root/.openclaw/workspace-frontend-dev/frontend
npm ci
npm run test
# For e2e, start dev server and use playwright as above.
```

---

## Expected Outcomes

### Backend

- All tests pass (green).
- Coverage >90% for rule engine.
- No errors about missing database tables.

### Frontend

- Vitest output shows tests passed.
- Components render without errors in jsdom.

### E2E

- Browser opens, navigates through pages.
- Login succeeds with `test-admin-token`.
- No uncaught errors in console.
- Tests complete within ~1 minute.

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `asyncpg` import error | Install `asyncpg` and `psycopg2-binary` with system libpq. |
| Connection refused to postgres | Ensure postgres is running and port 5432 is open. |
| Playwright browsers missing | Run `npx playwright install chromium` after npm ci. |
| Frontend tests fail on `Recharts` SSR | Ensure `testEnvironment: jsdom` and `jest-dom` imported. |
| E2E tests time out | Wait longer for backend to start. Increase Playwright `timeout`. |

---

## CI/CD Integration

Sample GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb
        env:
          POSTGRES_PASSWORD: postgres
        ports: [5432:5432]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install deps
        run: |
          cd backend_minimal
          pip install -r requirements.txt
      - name: Create test DB
        run: |
          sudo -u postgres psql -c "CREATE DATABASE antibot_test;"
      - name: Run tests
        run: |
          cd backend_minimal
          pytest --junitxml=report.xml --cov=app --cov-report=xml

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install
        run: |
          cd frontend
          npm ci
      - name: Run unit tests
        run: |
          cd frontend
          npm run test -- --coverage --reporter=json --output=coverage/coverage.json
```

---

That’s it. Run tests and verify all pass before deploying.
