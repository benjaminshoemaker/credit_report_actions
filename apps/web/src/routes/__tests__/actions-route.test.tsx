import React from 'react';
import { beforeEach, describe, expect, it, vi, afterEach, type Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ActionsRoute from '../ActionsRoute';
import type { AnalysisState } from '../../state/app-state';

const mockLogin = vi.fn();

vi.mock('../../auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'mock-token',
    idToken: 'mock-id',
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

describe('ActionsRoute', () => {
  const analysis: AnalysisState = {
    source: 'equifax',
    metrics: {
      coveragePercent: 80,
      numericExactPercent: 70,
      categoricalDatePercent: 75
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
        balance: 2000,
        creditLimit: 5000,
        highCredit: 5200,
        openDate: '2019-04',
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
          productType: 'Revolving',
          status: 'Open',
          balance: 2000,
          creditLimit: 5000,
          highCredit: 5200
        }
      }
    ]
  };

  beforeEach(() => {
    mockUseAppState.mockReturnValue({
      state: { analysis }
    });
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: [
          {
            id: 'action-apr-reduction',
            type: 'apr_reduction',
            title: 'Request an APR reduction',
            summary: 'Mock summary for APR reduction.',
            estimatedSavingsUsd: 45,
            probabilityOfSuccess: 0.4,
            scenarioRange: { low: 30, high: 60 },
            nextSteps: ['Call the issuer'],
            tags: [],
            metadata: {
              cashNeededUsd: 0,
              timeToEffectMonths: 3,
              scoreImpact: 'medium',
              whyThis: ['Reason A', 'Reason B']
            }
          }
        ],
        warnings: [
          {
            code: 'missing_limits',
            message: 'Test warning message.',
            level: 'warning'
          }
        ],
        audit: {
          engineVersion: 'v1.0.0',
          computeMs: 10
        }
      })
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockLogin.mockReset();
  });

  it('submits prompts and renders action cards', async () => {
    render(
      <MemoryRouter initialEntries={['/actions']}>
        <Routes>
          <Route path="/actions" element={<ActionsRoute />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /generate actions/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = (global.fetch as unknown as Mock).mock.calls[0];
    expect(fetchCall[0]).toMatch(/\/analyze$/);
    const payload = JSON.parse(fetchCall[1].body);
    expect(payload.accounts).toHaveLength(1);
    expect(payload.flags.any60dLate).toBe(false);

    await waitFor(() => {
      expect(screen.getByText(/Mock summary for APR reduction/i)).toBeInTheDocument();
      expect(screen.getByText(/Reason A/)).toBeInTheDocument();
      expect(screen.getByText(/Test warning message/i)).toBeInTheDocument();
    });
  });
});
