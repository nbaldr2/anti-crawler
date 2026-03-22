import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllowDenyLists } from '@/components/AllowDenyLists';
import * as useListsHook from '@/hooks/useLists';

vi.mock('@/hooks/useLists', () => ({
  useLists: vi.fn((tab) => ({
    items: tab === 'allowlist'
      ? [{ ip: '192.168.1.0/24', reason: 'Internal', expires_at: null }]
      : [{ ip: '203.0.113.0/24', reason: 'Bad', expires_at: null }],
    loading: false,
    error: null,
    addItem: vi.fn().mockResolvedValue({}),
    removeItem: vi.fn().mockResolvedValue({}),
  })),
}));

describe('AllowDenyLists Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<AllowDenyLists />);
    expect(screen.getByText('Allow/Deny Lists')).toBeInTheDocument();
  });

  it('shows tabs for allowlist and denylist', () => {
    render(<AllowDenyLists />);
    expect(screen.getByText('Allowlist')).toBeInTheDocument();
    expect(screen.getByText('Denylist')).toBeInTheDocument();
  });

  it('displays list items for active tab', () => {
    render(<AllowDenyLists />);
    // Default is allowlist
    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<AllowDenyLists />);

    await user.click(screen.getByText('Denylist'));

    await waitFor(() => {
      expect(screen.getByText('203.0.113.0/24')).toBeInTheDocument();
    });
  });

  it('shows add entry form', () => {
    render(<AllowDenyLists />);
    expect(screen.getByLabelText(/CIDR/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/)).toBeInTheDocument();
    expect(screen.getByText(/Add to Allowlist/)).toBeInTheDocument();
  });

  it('shows bulk import/export controls', () => {
    render(<AllowDenyLists />);
    expect(screen.getByText('Bulk Operations')).toBeInTheDocument();
    expect(screen.getByText('Export Current List')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste list here/)).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('displays remove button for each item', () => {
    render(<AllowDenyLists />);
    expect(screen.getAllByText('Remove').length).toBeGreaterThan(0);
  });
});
