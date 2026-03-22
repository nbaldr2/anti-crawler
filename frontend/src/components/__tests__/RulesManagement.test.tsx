import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesManagement } from '@/components/RulesManagement';
import * as useRulesHook from '@/hooks/useRules';
import { api } from '@/services/api';

vi.mock('@/hooks/useRules', () => ({
  useRules: vi.fn(() => ({
    rules: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Block Bad Bots',
        description: 'Blocks known bots',
        condition_type: 'user_agent',
        condition: { pattern: 'Bot' },
        weight: 30,
        action: 'block',
        enabled: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-02'),
      },
    ],
    loading: false,
    error: null,
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  })),
}));

vi.mock('@/services/api', () => ({
  api: {
    evaluate: vi.fn().mockResolvedValue({
      score: 45,
      verdict: 'rate_limit',
      rule_triggers: ['rule-1'],
    }),
  },
}));

describe('RulesManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and rule table', () => {
    render(<RulesManagement />);
    expect(screen.getByText('Rules Management')).toBeInTheDocument();
    expect(screen.getByText('Block Bad Bots')).toBeInTheDocument();
  });

  it('shows create new rule button', () => {
    render(<RulesManagement />);
    expect(screen.getByText('Create New Rule')).toBeInTheDocument();
  });

  it('opens create form modal when clicking create button', async () => {
    const user = userEvent.setup();
    render(<RulesManagement />);

    await user.click(screen.getByText('Create New Rule'));

    await waitFor(() => {
      expect(screen.getByText('Create Rule')).toBeInTheDocument();
    });
  });

  it('displays rule table columns correctly', () => {
    render(<RulesManagement />);
    expect(screen.getByText('Block Bad Bots')).toBeInTheDocument();
    expect(screen.getByText('Blocks known bots')).toBeInTheDocument();
    expect(screen.getByText('user_agent')).toBeInTheDocument();
    expect(screen.getByText('block')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows action buttons for each rule', () => {
    render(<RulesManagement />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('opens edit form when clicking edit button', async () => {
    const user = userEvent.setup();
    render(<RulesManagement />);

    await user.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(screen.getByText('Edit Rule')).toBeInTheDocument();
    });
  });

  it('has live rule test panel', () => {
    render(<RulesManagement />);
    expect(screen.getByText('Live Rule Test')).toBeInTheDocument();
    expect(screen.getByLabelText(/IP/)).toBeInTheDocument();
    expect(screen.getByLabelText(/User-Agent/)).toBeInTheDocument();
    expect(screen.getByText('Test Rule')).toBeInTheDocument();
  });

  it('runs live test when button clicked', async () => {
    const user = userEvent.setup();
    render(<RulesManagement />);

    await user.click(screen.getByText('Test Rule'));

    await waitFor(() => {
      expect(api.evaluate).toHaveBeenCalled();
    });
  });

  it('displays test result when available', async () => {
    render(<RulesManagement />);
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
