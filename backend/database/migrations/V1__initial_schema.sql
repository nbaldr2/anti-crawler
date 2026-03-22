-- V1__initial_schema.sql
-- Antibot Detection Engine - Initial Schema
-- Compatible with PostgreSQL + TimescaleDB

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Table: ip_blocklist
-- Preloaded external blocklist data (from scraper)
CREATE TABLE ip_blocklist (
    id BIGSERIAL PRIMARY KEY,
    ip INET NOT NULL,
    source_url TEXT NOT NULL,
    category TEXT NOT NULL,
    risk_score DECIMAL(3,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ip, source_url)
);
CREATE INDEX idx_ip_blocklist_ip ON ip_blocklist (ip);

-- Table: user_agent_blocklist
-- Known bot user agents (seeded)
CREATE TABLE user_agent_blocklist (
    id BIGSERIAL PRIMARY KEY,
    pattern TEXT NOT NULL,  -- regex pattern
    description TEXT,
    risk_score DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_user_agent_blocklist_pattern ON user_agent_blocklist (pattern);

-- Table: allowlist
CREATE TABLE allowlist (
    id BIGSERIAL PRIMARY KEY,
    ip CIDR NOT NULL,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ip)
);

-- Table: denylist
CREATE TABLE denylist (
    id BIGSERIAL PRIMARY KEY,
    ip CIDR NOT NULL,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ip)
);

-- Table: api_tokens (for admin API access)
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash CHAR(64) NOT NULL UNIQUE,
    sub TEXT NOT NULL,
    scope JSONB NOT NULL,  -- array of strings, e.g. ["admin"]
    rate_limit_override INT,  -- requests per minute
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: rules
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('ip_reputation','user_agent','header','rate_limit','tls','custom')),
    condition JSONB NOT NULL,
    weight SMALLINT NOT NULL CHECK (weight BETWEEN 0 AND 100),
    action TEXT NOT NULL CHECK (action IN ('allow','rate_limit','block','challenge')),
    threshold_override JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rules_enabled ON rules (enabled) WHERE enabled = true;

-- Table: request_logs
CREATE TABLE request_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip INET NOT NULL,
    user_agent TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    verdict TEXT NOT NULL CHECK (verdict IN ('allow','rate_limit','challenge','block')),
    rule_triggers JSONB,  -- array of rule UUIDs
    metadata JSONB,
    ip_hash CHAR(64)  -- SHA256 of IP, populated after 30d
);
CREATE INDEX idx_request_logs_timestamp ON request_logs (timestamp DESC);
CREATE INDEX idx_request_logs_ip_hash ON request_logs (ip_hash) WHERE ip_hash IS NOT NULL;
CREATE INDEX idx_request_logs_verdict ON request_logs (verdict);

-- Table: audit_log
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    details JSONB
);
CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);

-- Table: settings (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: metrics (TimescaleDB hypertable)
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rps INT NOT NULL,
    block_count INT NOT NULL,
    challenge_count INT NOT NULL,
    allow_count INT NOT NULL,
    top_offenders JSONB
);
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 hour');

-- Table: rate_limit_counters (for sliding window; consider Redis in prod)
CREATE TABLE rate_limit_counters (
    key TEXT PRIMARY KEY,
    count INT NOT NULL DEFAULT 1,
    reset_time TIMESTAMPTZ NOT NULL
);
-- Index for cleanup
CREATE INDEX idx_rate_limit_reset ON rate_limit_counters (reset_time);

-- Function: hash_old_ips (to be called by cron/app)
CREATE OR REPLACE FUNCTION hash_old_ips() RETURNS void AS $$
BEGIN
    UPDATE request_logs
    SET ip_hash = encode(digest(ip::text, 'sha256'), 'hex')
    WHERE ip_hash IS NULL
      AND timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_rate_limit_counters
CREATE OR REPLACE FUNCTION cleanup_rate_limit_counters() RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_counters WHERE reset_time < NOW();
END;
$$ LANGUAGE plpgsql;

-- View: current_blocked_ips (for quick lookup)
CREATE OR REPLACE VIEW current_blocked_ips AS
SELECT ip FROM denylist
WHERE expires_at IS NULL OR expires_at > NOW()
UNION
SELECT ip FROM request_logs
WHERE verdict IN ('block','challenge') AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip;

-- Seed default settings (thresholds, weights, rate limits, PoW)
INSERT INTO settings (key, value) VALUES
('scoring_thresholds', '{"low":20,"medium":50,"high":80}'),
('weights', '{"ip_rep":30,"user_agent":20,"request_pattern":20,"behavioral":15,"tls":10,"headless":5}'),
('rate_limit', '{"default_rps":10,"burst":20,"key_ttl":60}'),
('pow', '{"initial_bits":18,"max_bits":24,"window_seconds":3600,"max_attempts":3}');

COMMIT;
