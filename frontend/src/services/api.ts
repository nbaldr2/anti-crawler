import { authService } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  async fetchAdmin<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken();
    if (!token) {
      throw new Error('Unauthorized');
    }

    const headers: HeadersInit = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    return response.json();
  },

  async health(): Promise<any> {
    return this.fetchAdmin('/admin/health');
  },

  async metricsOverview(): Promise<any> {
    return this.fetchAdmin('/admin/metrics/overview');
  },

  async topOffenders(limit: number = 10): Promise<any> {
    const url = new URL(`${API_BASE}/admin/metrics/top-offenders`);
    url.searchParams.set('limit', limit.toString());
    return this.fetchAdmin(url.pathname + url.search);
  },

  async searchLogs(params: Record<string, any>): Promise<any> {
    const url = new URL(`${API_BASE}/admin/logs`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value.toString());
      }
    });
    return this.fetchAdmin(url.pathname + url.search);
  },

  async listRules(): Promise<any> {
    return this.fetchAdmin('/admin/rules');
  },

  async createRule(rule: any): Promise<any> {
    return this.fetchAdmin('/admin/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  },

  async getRule(id: string): Promise<any> {
    return this.fetchAdmin(`/admin/rules/${id}`);
  },

  async updateRule(id: string, updates: any): Promise<any> {
    return this.fetchAdmin(`/admin/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteRule(id: string): Promise<void> {
    return this.fetchAdmin(`/admin/rules/${id}`, { method: 'DELETE' });
  },

  async listAllowlist(): Promise<any> {
    return this.fetchAdmin('/admin/allowlist');
  },

  async addAllowlist(item: { ip: string; reason?: string; expires_at?: string }): Promise<any> {
    return this.fetchAdmin('/admin/allowlist', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async removeAllowlist(cidr: string): Promise<any> {
    return this.fetchAdmin(`/admin/allowlist/${encodeURIComponent(cidr)}`, { method: 'DELETE' });
  },

  async listDenylist(): Promise<any> {
    return this.fetchAdmin('/admin/denylist');
  },

  async addDenylist(item: { ip: string; reason?: string; expires_at?: string }): Promise<any> {
    return this.fetchAdmin('/admin/denylist', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async removeDenylist(cidr: string): Promise<any> {
    return this.fetchAdmin(`/admin/denylist/${encodeURIComponent(cidr)}`, { method: 'DELETE' });
  },

  async generateToken(tokenReq: any): Promise<any> {
    return this.fetchAdmin('/admin/tokens/generate', {
      method: 'POST',
      body: JSON.stringify(tokenReq),
    });
  },

  async getSettings(): Promise<Record<string, any>> {
    return this.fetchAdmin('/admin/settings');
  },

  async updateSettings(updates: any): Promise<any> {
    return this.fetchAdmin('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Public endpoint (no auth)
  async evaluate(req: any): Promise<any> {
    const response = await fetch(`${API_BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!response.ok) {
      throw new Error(`Evaluate error: ${response.status}`);
    }
    return response.json();
  },
};