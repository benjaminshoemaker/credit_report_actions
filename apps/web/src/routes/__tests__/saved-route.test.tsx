import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SavedRoute from '../SavedRoute';

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

describe('SavedRoute', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockUseAppState.mockReturnValue({
      state: { analysis: null }
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders saved items list with stale indicator', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            item_id: 'item-1',
            type: 'letter',
            template_id: 'dispute-style-a',
            payload_no_pii: {
              letterHtml: '<p>Letter</p>',
              analyzeInput: null
            },
            engine_version: 'v0.9.0',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            stale: true
          }
        ]
      })
    } as unknown as Response);

    render(
      <MemoryRouter initialEntries={['/saved']}>
        <Routes>
          <Route path="/saved" element={<SavedRoute />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Saved items/)).toBeInTheDocument();
      expect(screen.getByText(/Stale/)).toBeInTheDocument();
    });
  });

  it('regenerates stale item and refreshes list', async () => {
    global.fetch = vi
      .fn()
      // initial GET
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              item_id: 'item-1',
              type: 'letter',
              template_id: 'dispute-style-a',
              payload_no_pii: {
                letterHtml: '<p>Letter</p>',
                analyzeInput: {
                  user: { id: 'local-user', scoreBand: 'unknown' },
                  accounts: [],
                  inquiries: []
                }
              },
              engine_version: 'v0.9.0',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              stale: true
            }
          ]
        })
      } as unknown as Response)
      // POST /analyze
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actions: [],
          warnings: [],
          audit: {
            engineVersion: 'v1.0.0'
          }
        })
      } as unknown as Response)
      // POST /items
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ item_id: 'item-2' })
      } as unknown as Response)
      // DELETE /items/:id
      .mockResolvedValueOnce({
        ok: true,
        text: async () => ''
      } as unknown as Response)
      // final GET
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              item_id: 'item-2',
              type: 'letter',
              template_id: 'dispute-style-a',
              payload_no_pii: {
                letterHtml: '<p>Letter</p>',
                analyzeInput: null
              },
              engine_version: 'v1.0.0',
              created_at: '2024-02-01T00:00:00Z',
              updated_at: '2024-02-01T00:00:00Z',
              stale: false
            }
          ]
        })
      } as unknown as Response);

    render(
      <MemoryRouter initialEntries={['/saved']}>
        <Routes>
          <Route path="/saved" element={<SavedRoute />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Regenerate/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
      expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
    });
  });
});

