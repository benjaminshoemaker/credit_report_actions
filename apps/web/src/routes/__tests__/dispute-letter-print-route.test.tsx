import React from 'react';
import { beforeEach, describe, expect, it, vi, afterEach, type Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DisputeLetterPrintRoute from '../DisputeLetterPrintRoute';
import type { AnalysisState } from '../../state/app-state';

const mockLogin = vi.fn();

vi.mock('../../auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'token-123',
    idToken: 'id-token',
    expiresAt: Date.now() + 3600 * 1000,
    login: mockLogin,
    logout: vi.fn(),
    completeLogin: vi.fn()
  })
}));

const mockUseAppState = vi.fn();

vi.mock('../../state/app-state', async () => {
  const actual = await vi.importActual('../../state/app-state');
  return {
    ...actual,
    AppStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAppState: () => mockUseAppState()
  };
});

describe('DisputeLetterPrintRoute', () => {
  const analysis: AnalysisState = {
    source: 'equifax',
    metrics: {
      coveragePercent: 82,
      numericExactPercent: 72,
      categoricalDatePercent: 70
    },
    requiresManualReview: false,
    accounts: [],
    bureauAccounts: [],
    mergedAccounts: [
      {
        id: 'prime-0',
        name: 'Prime Bank Visa',
        bureaus: ['equifax'],
        ownership: 'joint',
        status: 'open',
        balance: 1800,
        creditLimit: 5000,
        highCredit: 5200,
        openDate: '2020-01',
        reportedDate: '2024-02',
        sourceAccounts: []
      }
    ],
    excludedAccounts: [],
    conflicts: [],
    inquiries: [],
    accountsNeedingReview: [],
    manualEdits: [
      {
        id: 'Prime Bank Visa',
        fields: {
          productType: 'Credit Card',
          status: 'Open',
          balance: 1800,
          creditLimit: 5000,
          highCredit: 5200
        }
      }
    ]
  };

  const originalFetch = global.fetch;
  const originalPrint = window.print;

  beforeEach(() => {
    mockUseAppState.mockReturnValue({
      state: { analysis }
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ item_id: 'item-1' })
    } as Response);
    window.print = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    window.print = originalPrint;
  });

  it('renders letter preview and handles print', () => {
    render(
      <MemoryRouter initialEntries={['/letter/print']}>
        <Routes>
          <Route path="/letter/print" element={<DisputeLetterPrintRoute />} />
        </Routes>
      </MemoryRouter>
    );

    const iframe = screen.getByTitle(/Dispute letter preview/i) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();

    const printButton = screen.getByRole('button', { name: /Print \/ Save as PDF/i });
    fireEvent.click(printButton);
    expect(window.print).toHaveBeenCalled();
  });

  it('saves letter via /items API', async () => {
    render(
      <MemoryRouter initialEntries={['/letter/print']}>
        <Routes>
          <Route path="/letter/print" element={<DisputeLetterPrintRoute />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Save letter/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/items$/),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    const [, options] = (global.fetch as unknown as Mock).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.type).toBe('letter');
    expect(body.template_id).toBe('dispute-style-a');
    expect(body.payload_no_pii.analyzeInput).toBeDefined();
    expect(screen.getByText(/Saved! Visit the Saved tab/)).toBeInTheDocument();
  });
});
