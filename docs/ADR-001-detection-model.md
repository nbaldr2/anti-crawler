# ADR-001: Detection Model and Scoring

## Status
Accepted

## Context
The antibot system must evaluate incoming HTTP requests and produce a numeric risk score (0-100) to determine whether to allow, rate-limit, or block. The scoring model must combine multiple signals: IP reputation, user-agent analysis, request patterns, behavioral metrics, and TLS fingerprinting.

## Decision
We adopt a **weighted scoring model** with configurable thresholds and rule-based overrides.

### Signal Categories and Weights

| Category | Weight | Description |
|----------|--------|-------------|
| IP Reputation | 30% | Queries blocklists (Spamhaus, Emerging Threats, etc.) |
| User-Agent | 20% | Known bot UA detection, anomalies, missing UA |
| Request Pattern | 20% | Rate limits, sequence anomalies, endpoint access |
| Behavioral | 15% | Mouse movement, scroll, click timing (client JS) |
| TLS Fingerprint | 10% | JA3/JA3S fingerprint matching known bot fingerprints |
| Headless Detection | 5% | Navigator properties, WebGL, fonts, plugins |

### Scoring Algorithm

```python
def compute_risk_score(request):
    score = 0.0
    for category, weight in weights.items():
        signals = collect_signals(request, category)
        category_score = aggregate_signals(signals)
        score += category_score * weight
    return min(100, max(0, score))
```

### Thresholds (default, configurable)

- **0-20**: Low risk → Allow
- **21-50**: Medium risk → Rate limit (e.g., 10 req/sec)
- **51-80**: High risk → Challenge (JS proof-of-work)
- **81-100**: Critical risk → Block (HTTP 403)

### Rules Engine
- Each rule defines condition, weight contribution, and optional hard override.
- Example: `if IP in denylist → score += 50, block = true`
- Rules are stored in PostgreSQL and can be reloaded without restart.

### Extensibility
- New signal types can be added via plugin modules.
- Weights and thresholds adjustable via admin API.

## Consequences
- Provides flexible, auditable scoring.
- Allows incremental tuning based on telemetry.
- Supports both automated and manual rule overrides.
