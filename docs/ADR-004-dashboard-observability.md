# ADR-004: Dashboard & Observability Architecture

## Status
Accepted

## Context
Security operators need real-time visibility into traffic, risk scores, blocking decisions, and the ability to drill down into incidents. The dashboard must be responsive, secure, and show high-volume metrics with low latency.

## Decision
Build a **React + WebSocket** dashboard backed by a **TimescaleDB** (PostgreSQL extension) for metrics and a REST API for queries.

### Architecture

```
[Browser] <--HTTPS/WebSocket--> [Dashboard Server (React)] <--REST--> [API Gateway]
                                                                     ↓
                                                             [Detection Engine + PostgreSQL]
```

### Pages & Widgets

1. **Overview** (default)
   - Total requests per second (RPS)
   - Allow/Block/Challenge percentages (pie chart)
   - Top 5 offending IPs (table)
   - Risk score distribution (histogram)
   - Real-time event stream (latest blocks)

2. **Traffic Drill-Down**
   - Search by IP, UA, endpoint, time range
   - Detailed request logs (with risk score, rule triggers)
   - Export to CSV/JSON

3. **Rules Management**
   - CRUD for detection rules
   - Live rule testing (simulate request)
   - Version history and rollback

4. **Allow/Deny Lists**
   - Manage entries with TTL and notes
   - Bulk import/export

5. **Settings**
   - Adjust scoring thresholds
   - Challenge difficulty parameters
   - API token generation

### Data Flow

- Real-time metrics: Detection engine publishes to Redis Pub/Sub; dashboard subscribes via WebSocket → updates every 1s.
- Historical queries: API fetches from TimescaleDB (continuous aggregates).
- Log storage: PostgreSQL with partitioning on `timestamp`.

### Performance

- Cache top-N offenders in Redis (refresh every 10s).
- Use materialized views for 1h/24h aggregates.
- Pagination for log queries (100 per page).

### Security

- Dashboard behind HTTPS with token-based auth (admin API token).
- Role-based access control: `viewer`, `operator`, `admin`.
- All admin actions logged to `audit_log`.

## Consequences
- Operators get immediate feedback and forensic capability.
- WebSocket provides live updates without polling.
- TimescaleDB handles high write volume and fast time-series queries.
