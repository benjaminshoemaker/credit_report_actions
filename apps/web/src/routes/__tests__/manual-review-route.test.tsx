import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ManualReviewRoute from '../ManualReviewRoute';
import { type AnalysisState } from '../../state/app-state';

// Mock the auth context to avoid async operations
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

// Mock the app state to provide controlled analysis data
const mockSaveManualEdit = vi.fn();
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
    state: { analysis },
    saveManualEdit: mockSaveManualEdit
  });

  return render(
    <MemoryRouter initialEntries={['/manual-review']}>
      <Routes>
        <Route path="/manual-review" element={<ManualReviewRoute />} />
        <Route path="/review" element={<div>Review page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ManualReviewRoute', () => {
  beforeEach(() => {
    mockSaveManualEdit.mockClear();
  });

  const analysis: AnalysisState = {
    source: 'equifax',
    metrics: {
      coveragePercent: 40,
      numericExactPercent: 30,
      categoricalDatePercent: 20
    },
    requiresManualReview: true,
    accounts: [],
    bureauAccounts: [],
    mergedAccounts: [],
    excludedAccounts: [],
    conflicts: [],
    inquiries: [],
    accountsNeedingReview: [
      {
        name: 'Test Card',
        rawLines: [],
        balance: undefined,
        creditLimit: undefined,
        highCredit: undefined,
        status: undefined,
        ownership: undefined,
        openDate: undefined,
        reportedDate: undefined
      }
    ],
    manualEdits: []
  };

  it('validates required fields before submission', () => {
    renderWithAnalysis(analysis);

    const submit = screen.getByRole('button', { name: /save and continue/i });
    fireEvent.click(submit);

    expect(screen.getByText(/gate b/i)).toBeDefined();
  });

  it('prefills values from saved manual edits', () => {
    const editedAnalysis: AnalysisState = {
      ...analysis,
      manualEdits: [
        {
          id: 'Test Card',
          fields: {
            productType: 'Installment',
            status: 'Open',
            balance: 1234,
            creditLimit: 6000
          }
        }
      ]
    };

    renderWithAnalysis(editedAnalysis);

    expect(screen.getByDisplayValue('Installment')).toBeDefined();
    expect(screen.getByDisplayValue('Open')).toBeDefined();
    expect(screen.getByDisplayValue('1234')).toBeDefined();
    expect(screen.getByDisplayValue('6000')).toBeDefined();
  });

  it('saves edits and navigates when fields are valid', async () => {
    renderWithAnalysis(analysis);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'Open' } });
    fireEvent.change(screen.getByLabelText(/balance/i), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/credit limit/i), { target: { value: '5000' } });

    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));

    await waitFor(() => {
      expect(mockSaveManualEdit).toHaveBeenCalledWith({
        id: 'Test Card',
        fields: expect.objectContaining({
          productType: 'Revolving',
          status: 'Open',
          balance: 1500,
          creditLimit: 5000,
          highCredit: undefined
        })
      });
    });

    expect(screen.getByText('Review page')).toBeInTheDocument();
  });
});
