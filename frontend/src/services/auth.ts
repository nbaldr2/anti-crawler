import { TokenResponse } from '@/types';

const TOKEN_KEY = 'admin_token';

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async login(token: string): Promise<TokenResponse> {
    // In this system, we just store the token; no dedicated login endpoint.
    // Optionally we could validate by calling /admin/health.
    this.setToken(token);
    return { token, token_id: '', sub: '', scope: [], expires_at: new Date().toISOString() };
  },

  logout(): void {
    this.clearToken();
  },
};