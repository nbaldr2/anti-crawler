-- Seeds: default rules, allowlist, user_agent_blocklist, admin token
-- This file is idempotent for dev environments

-- Clear existing data (use with caution)
TRUNCATE rules RESTART IDENTITY CASCADE;
TRUNCATE allowlist RESTART IDENTITY CASCADE;
TRUNCATE denylist RESTART IDENTITY CASCADE;
TRUNCATE user_agent_blocklist RESTART IDENTITY CASCADE;
TRUNCATE api_tokens RESTART IDENTITY CASCADE;
TRUNCATE settings RESTART IDENTITY CASCADE;

-- Re-insert default settings
INSERT INTO settings (key, value) VALUES
('scoring_thresholds', '{"low":20,"medium":50,"high":80}'),
('weights', '{"ip_rep":30,"user_agent":20,"request_pattern":20,"behavioral":15,"tls":10,"headless":5}'),
('rate_limit', '{"default_rps":10,"burst":20,"key_ttl":60}'),
('pow', '{"initial_bits":18,"max_bits":24,"window_seconds":3600,"max_attempts":3}');

-- Default rules (based on ADRs)

-- 1. IP Blocklist (high risk) -> block
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('11111111-1111-1111-1111-111111111111', 'IP Blocklist High Risk', 'IP in blocklist with risk >= 0.8', 'ip_reputation', '{"source":"blocklist","min_risk":0.8}', 30, 'block', true);

-- 2. Denylist IP -> block (hard)
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('22222222-2222-2222-2222-222222222222', 'Denylist IP', 'IP in explicit denylist', 'ip_reputation', '{"source":"denylist"}', 100, 'block', true);

-- 3. Allowlist IP -> allow (score 0)
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('33333333-3333-3333-3333-333333333333', 'Allowlist IP', 'IP in explicit allowlist', 'ip_reputation', '{"source":"allowlist"}', 0, 'allow', true);

-- 4. Known bot User-Agent -> block
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('44444444-4444-4444-4444-444444444444', 'Bot User-Agent', 'UA matches known bot pattern', 'user_agent', '{"pattern":"(bot|crawler|spider|python-urllib|curl|wget|httpie)"}', 20, 'block', true);

-- 5. Missing User-Agent -> rate limit
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('55555555-5555-5555-5555-555555555555', 'Missing User-Agent', 'User-Agent header missing', 'user_agent', '{"missing":true}', 10, 'rate_limit', true);

-- 6. Rate limit exceeded -> rate limit
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('66666666-6666-6666-6666-666666666666', 'Excessive Requests', 'Rate limit threshold exceeded', 'rate_limit', '{"threshold":100}', 20, 'rate_limit', true);

-- 7. Admin endpoint abuse -> challenge
INSERT INTO rules (id, name, description, condition_type, condition, weight, action, enabled) VALUES
('77777777-7777-7777-7777-777777777777', 'Admin Endpoint Abuse', 'Too many requests to /admin', 'request_pattern', '{"endpoint_prefix":"/admin","threshold":20}', 15, 'challenge', true);

-- Sample blocklist entries
INSERT INTO ip_blocklist (ip, source_url, category, risk_score) VALUES
('108.62.56.225', 'https://lists.blocklist.de/lists/all.txt', 'blocklist_de', 0.8),
('216.151.138.181', 'https://lists.blocklist.de/lists/all.txt', 'blocklist_de', 0.8),
('183.56.233.121', 'https://lists.blocklist.de/lists/all.txt', 'blocklist_de', 0.8);

-- Default allowlist entries (private ranges, localhost)
INSERT INTO allowlist (ip, reason, created_by) VALUES
('127.0.0.1/32', 'Local dev', 'system'),
('::1/128', 'Local IPv6', 'system'),
('10.0.0.0/8', 'Private network', 'system'),
('192.168.0.0/16', 'Private network', 'system'),
('172.16.0.0/12', 'Private network', 'system');

-- Default user agent blocklist (common bots)
INSERT INTO user_agent_blocklist (pattern, description, risk_score) VALUES
('Python-urllib/.*', 'Python URL library', 0.8),
('curl/.*', 'cURL', 0.5),
('wget/.*', 'Wget', 0.5),
('httpie/.*', 'HTTPie', 0.5),
('(bot|crawler|spider|scraper|harvester|scanner)', 'Generic bot', 0.7),
('HeadlessChrome/.*', 'Headless Chrome', 0.9),
('PhantomJS/.*', 'PhantomJS', 0.9),
('Selenium/.*', 'Selenium', 0.8),
('Puppeteer/.*', 'Puppeteer', 0.8),
('Playwright/.*', 'Playwright', 0.8);

-- Note: Admin API token is configured via API_TOKEN environment variable.
-- Use /admin/tokens/generate endpoint to create tokens.

COMMIT;
