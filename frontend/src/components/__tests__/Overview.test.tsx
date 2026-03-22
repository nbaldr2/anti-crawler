import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Overview } from '@/components/Overview';
import * as useMetricsHook from '@/hooks/useMetrics';
import * as useLogsHook from '@/hooks/useLogs';

// Mock the hooks
vi.mock('@/hooks/useMetrics', () => ({
  useMetrics: vi.fn(() => ({
    overview: { rps: 42.5, allow_percent: 80, block_percent: 10, challenge_percent: 10 },
    offenders: [{ ip: '192.0.2.1', count: 100 }, { ip: '198.51.100.2', count: 50 }],
    loading: false,
  })),
}));

vi.mock('@/hooks/useLogs', () => ({
  useLogs: vi.fn(() => ({
    logs: [
      {
        id: 1,
        timestamp: '2026-03-21T20:00:00Z',
        ip: '203.0.113.1',
        user_agent: 'BadBot',
        endpoint: '/login',
        method: 'POST',
        risk_score: 95,
        verdict: 'block',
        rule_triggers: ['rule-1'],
      },
      {
        id: 2,
        timestamp: '2026-03-21T20:01:00Z',
        ip: '198.51.100.2',
        user_agent: 'Mozilla/5.0',
        endpoint: '/',
        method: 'GET',
        risk_score: 5,
        verdict: 'allow',
        rule_triggers: [],
      },
    ],
    updateFilters: vi.fn(),
    loading: false,
    error: null,
    total: 2,
    nextOffset: null,
    loadMore: vi.fn(),
  })),
}));

describe('Overview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title', () => {
    render(<Overview />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('displays RPS value', () => {
    render(<Overview />);
    expect(screen.getByText('42.5')).toBeInTheDocument();
  });

  it('displays top offenders', () => {
    render(<Overview />);
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
    expect(screen.getByText('198.51.100.2')).toBeInTheDocument();
  });

  it('displays verdict distribution pie chart', () => {
    render(<Overview />);
    expect(screen.getByText('Allow')).toBeInTheDocument();
    expect(screen.getByText('Block')).toBeInTheDocument();
    expect(screen.getByText('Challenge')).toBeInTheDocument();
  });

  it('shows block events list', async () => {
    render(<Overview />);
    await waitFor(() => {
      expect(screen.getByText('Latest Block Events')).toBeInTheDocument();
      expect(screen.getByText('BLOCK')).toBeInTheDocument();
    });
  });

  it('renders risk distribution bar chart', () => {
    render(<Overview />);
    expect(screen.getByText('Risk Score Distribution (Sample)')).toBeInTheDocument();
  });
});
