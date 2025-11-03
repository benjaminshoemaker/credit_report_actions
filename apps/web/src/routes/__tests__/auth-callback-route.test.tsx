import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import AuthCallbackRoute from '../AuthCallbackRoute';
import { AuthProvider, AUTH_SESSION_KEY } from '../../auth/auth-context';
import { saveAuthSession } from '../../auth/storage';

const renderWithRouter = (initialPath: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackRoute />} />
          <Route path="/upload" element={<div>Upload Route</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

describe('AuthCallbackRoute', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        id_token: 'id-token',
        expires_in: 3600
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the code and redirects to the stored return path', async () => {
    saveAuthSession({
      state: 'state-123',
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnPath: '/upload'
    });

    renderWithRouter('/auth/callback?code=test-code&state=state-123');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull());
    expect(localStorage.length).toBe(0);
    await waitFor(() => expect(screen.getByText('Upload Route')).toBeDefined());
  });

  it('shows an error when state does not match', async () => {
    saveAuthSession({
      state: 'expected',
      codeVerifier: 'verifier',
      nonce: 'nonce'
    });

    renderWithRouter('/auth/callback?code=test-code&state=wrong');

    await waitFor(() => expect(screen.getByText(/authentication failed/i)).toBeDefined());
  });
});
