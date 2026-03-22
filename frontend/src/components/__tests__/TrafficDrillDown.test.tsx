import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrafficDrillDown } from '@/components/TrafficDrillDown';
import * as useLogsHook from '@/hooks/useLogs';

vi.mock('@/hooks/useLogs', () => ({
  useLogs: vi.fn(() => ({
    logs: [
      {
        id: 1,
        timestamp: '2026-03-21T20:00:00Z',
        ip: '192.0.2.1',
        user_agent: 'Mozilla/5.0',
        endpoint: '/api/products',
        method: 'GET',
        risk_score: 12,
        verdict: 'allow',
        rule_triggers: [],
      },
    ],
    updateFilters: vi.fn(),
    loading: false,
    error: null,
    total: 1,
    nextOffset: null,
    loadMore: vi.fn(),
  })),
}));

describe('TrafficDrillDown Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<TrafficDrillDown />);
    expect(screen.getByText('Traffic Drill-Down')).toBeInTheDocument();
  });

  it('displays search form', () => {
    render(<TrafficDrillDown />);
    expect(screen.getByLabelText(/IP Address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Verdict/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/)).toBeInTheDocument();
  });

  it('shows logs table with data', () => {
    render(<TrafficDrillDown />);
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
    expect(screen.getByText('/api/products')).toBeInTheDocument();
  });

  it('has export buttons', () => {
    render(<TrafficDrillDown />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
  });

  it('allows typing in search fields', async () => {
    const user = userEvent.setup();
    render(<TrafficDrillDown />);

    const ipInput = screen.getByLabelText(/IP Address/);
    await user.type(ipInput, '192.168.1.1');
    expect(ipInput).toHaveValue('192.168.1.1');
  });

  it('shows advanced filters on toggle', async () => {
    const user = userEvent.setup();
    render(<TrafficDrillDown />);

    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await user.click(toggleButton);

    expect(screen.getByLabelText(/User-Agent/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Endpoint/)).toBeInTheDocument();
  });

  it('displays total results count', () => {
    render(<TrafficDrillDown />);
    expect(screen.getByText(/Total results:/)).toBeInTheDocument();
  });
});
