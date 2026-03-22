// API Response Types

export interface HealthResponse {
  status: string;
  database: string;
  redis: string;
}

export interface MetricsOverview {
  rps: number;
  allow_percent: number;
  block_percent: number;
  challenge_percent: number;
}

export interface TopOffender {
  ip: string;
  count: number;
}

export interface TopOffendersResponse {
  offenders: TopOffender[];
}

export interface LogEntry {
  id: number;
  timestamp: string;
  ip: string;
  user_agent?: string;
  endpoint: string;
  method: string;
  risk_score: number;
  verdict: 'allow' | 'block' | 'challenge';
  rule_triggers?: string[];
  metadata?: Record<string, any>;
}

export interface LogSearchResponse {
  total: number;
  logs: LogEntry[];
  next_offset?: number;
}

// Rules
export interface RuleBase {
  name: string;
  description?: string;
  condition_type: string;
  condition: Record<string, any>;
  weight: number;
  action: string; // allow, block, challenge, rate-limit
  threshold_override?: Record<string, number>;
  enabled: boolean;
}

export interface RuleCreate extends RuleBase {}

export interface RuleUpdate {
  name?: string;
  description?: string;
  condition_type?: string;
  condition?: Record<string, any>;
  weight?: number;
  action?: string;
  threshold_override?: Record<string, any>;
  enabled?: boolean;
}

export interface RuleResponse extends RuleBase {
  id: string;
  created_at: string;
  updated_at: string;
}

// Allowlist/Denylist
export interface ListItem {
  ip: string;
  reason?: string;
  expires_at?: string;
}

// Token
export interface TokenGenerateRequest {
  sub: string;
  scope: string[];
  rate_limit_override?: number;
  expires_in_days?: number;
}

export interface TokenResponse {
  token: string;
  token_id: string;
  sub: string;
  scope: string[];
  expires_at: string;
}

// Settings
export interface SettingsUpdate {
  scoring_thresholds?: { low: number; medium: number; high: number };
  weights?: Record<string, number>;
  rate_limit?: Record<string, any>;
  pow?: Record<string, number>;
}

// Evaluation request/response (public endpoint)
export interface EvaluateRequest {
  ip: string;
  user_agent?: string;
  headers?: Record<string, string>;
  tls_ja3?: string;
  path: string;
  method: string;
  body_hash?: string;
}

export interface EvaluateResponse {
  score: number;
  verdict: 'allow' | 'block' | 'challenge';
  rule_triggers: string[];
  challenge?: {
    type: string;
    bits: number;
    nonce: string;
    algorithm: string;
  };
}

// WebSocket messages (expected)
export type WSMessage =
  | { type: 'metrics_update'; data: MetricsOverview }
  | { type: 'new_log'; data: LogEntry }
  | { type: 'error'; message: string };

// UI State
export interface SearchFilters {
  ip?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  verdict?: 'allow' | 'block' | 'challenge';
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface RiskDistribution {
  score: number;
  count: number;
}