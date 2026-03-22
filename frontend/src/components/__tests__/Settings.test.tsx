import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '@/components/Settings';
import * as useSettingsHook from '@/hooks/useSettings';
import { api } from '@/services/api';

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    settings: {
      scoring_thresholds: { low: 20, medium: 50, high: 80 },
      weights: { ip_reputation: 30, user_agent: 20, request_pattern: 20, behavioral: 15, tls_fingerprint: 10, headless_detection: 5 },
      rate_limit: { burst: 20, window: 60 },
      pow: { bits: 18, expiry_seconds: 3600 },
    },
    loading: false,
    error: null,
    updateSettings: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@/services/api', () => ({
  api: {
    generateToken: vi.fn().mockResolvedValue({ token: 'abc123token', sub: 'admin', scope: ['admin'], expires_at: new Date() }),
  },
}));

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays scoring thresholds with current values', () => {
    render(<Settings />);
    expect(screen.getByText('Scoring Thresholds')).toBeInTheDocument();
    // There should be inputs with values 20, 50, 80
    const inputs = screen.getAllByRole('spinbutton');
    const values = inputs.map(i => (i as HTMLInputElement).value);
    expect(values).toContain('20');
    expect(values).toContain('50');
    expect(values).toContain('80');
  });

  it('displays category weights', () => {
    render(<Settings />);
    expect(screen.getByText(/Category Weights/)).toBeInTheDocument();
    expect(screen.getByLabelText(/ip reputation/i)).toBeInTheDocument();
  });

  it('displays rate limit settings', () => {
    render(<Settings />);
    expect(screen.getByText('Rate Limit')).toBeInTheDocument();
    // Burst should be 20
    expect(screen.getByLabelText(/Burst/)).toHaveValue(20);
  });

  it('displays PoW settings', () => {
    render(<Settings />);
    expect(screen.getByText('Proof-of-Work')).toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Bits/)).toHaveValue(18);
  });

  it('has token generation form', () => {
    render(<Settings />);
    expect(screen.getByText('Generate Admin Token')).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Scope/)).toBeInTheDocument();
    expect(screen.getByText('Generate Token')).toBeInTheDocument();
  });

  it('generates token on submit', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(screen.getByText('Generate Token'));

    await waitFor(() => {
      expect(api.generateToken).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/New Token/)).toBeInTheDocument();
    });
  });
});
