import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewRoute from '../ReviewRoute';
import type { AnalysisState } from '../../state/app-state';

vi.mock('../../auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'mock-token',
    idToken: 'mock-id-token',
    expiresAt: Date.now() + 3600000,
    login: vi.fn(),
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

const renderWithAnalysis = (analysis: AnalysisState | null) => {
  mockUseAppState.mockReturnValue({
    state: { analysis }
  });

  return render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<ReviewRoute />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ReviewRoute', () => {
  const analysis: AnalysisState = {
    source: 'equifax',
    metrics: {
      coveragePercent: 85,
      numericExactPercent: 75,
      categoricalDatePercent: 80
    },
    requiresManualReview: false,
    accounts: [],
    bureauAccounts: [
      {
        name: 'Prime Bank Visa',
        rawLines: [],
        bureau: 'equifax',
        reportedDate: '2024-02',
        balance: 1300,
        creditLimit: 4800,
        highCredit: 5200,
        ownership: 'joint',
        status: 'open'
      }
    ],
    mergedAccounts: [
      {
        id: 'prime-0',
        name: 'Prime Bank Visa',
        bureaus: ['equifax', 'transunion'],
        ownership: 'joint',
        status: 'open',
        balance: 1300,
        creditLimit: 4800,
        highCredit: 5200,
        openDate: '2018-06',
        reportedDate: '2024-03',
        sourceAccounts: [
          {
            bureau: 'equifax',
            reportedDate: '2024-02',
            balance: 1200,
            creditLimit: 5000,
            ownership: 'individual',
            status: 'open'
          },
          {
            bureau: 'transunion',
            reportedDate: '2024-03',
            balance: 1300,
            creditLimit: 4800,
            ownership: 'joint',
            status: 'open'
          }
        ]
      }
    ],
    excludedAccounts: [
      {
        id: 'store-0',
        name: 'Store Card AU',
        bureaus: ['experian'],
        ownership: 'authorized_user',
        status: 'open',
        balance: 350,
        creditLimit: 1500,
        highCredit: undefined,
        openDate: '2020-09',
        reportedDate: '2024-02',
        sourceAccounts: [
          {
            bureau: 'experian',
            reportedDate: '2024-02',
            balance: 350,
            creditLimit: 1500,
            ownership: 'authorized_user',
            status: 'open'
          }
        ]
      }
    ],
    conflicts: [
      {
        accountName: 'Prime Bank Visa',
        field: 'balance',
        chosen: {
          bureau: 'transunion',
          value: 1300,
          reportedDate: '2024-03'
        },
        others: [
          {
            bureau: 'equifax',
            value: 1200,
            reportedDate: '2024-02'
          }
        ],
        resolution: 'latest'
      }
    ],
    inquiries: [],
    accountsNeedingReview: [],
    manualEdits: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders merged accounts, conflicts, and excluded lists', () => {
    renderWithAnalysis(analysis);

    expect(screen.getAllByText('Prime Bank Visa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Joint').length).toBeGreaterThan(0);
    expect(screen.getByText(/Conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/Store Card AU/i)).toBeInTheDocument();
    expect(screen.getByText(/Keeping TransUnion/i)).toBeInTheDocument();
    expect(screen.getByText(/Using 1\/3 bureau reports/i)).toBeInTheDocument();
  });

  it('asks user to upload when analysis is missing', () => {
    renderWithAnalysis(null);
    expect(
      screen.getByText(/Upload a report first to generate merged tradelines/i)
    ).toBeInTheDocument();
  });
});
