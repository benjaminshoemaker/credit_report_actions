import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth, AUTH_SESSION_KEY } from '../auth-context';
import { saveAuthSession } from '../storage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider completeLogin', () => {
  const fetchMock = vi.fn();
  const storagePrototype = Object.getPrototypeOf(window.localStorage);
  const setItemSpy = vi.spyOn(storagePrototype, 'setItem');

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        id_token: 'id-token',
        expires_in: 4000
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    localStorage.clear();
    fetchMock.mockClear();
    setItemSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses tokens and keeps them in memory only', async () => {
    saveAuthSession({
      state: 'abc',
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnPath: '/upload'
    });
    setItemSpy.mockClear();

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.completeLogin('auth-code', 'abc');
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/oauth2/token'), expect.anything());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe('access-token');
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
    const tokenWrite = setItemSpy.mock.calls.find(([, value]) =>
      typeof value === 'string' && value.includes('access-token')
    );
    expect(tokenWrite).toBeUndefined();
  });

  it('throws when state does not match', async () => {
    saveAuthSession({
      state: 'expected',
      codeVerifier: 'verifier',
      nonce: 'nonce'
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.completeLogin('auth-code', 'mismatch')).rejects.toThrow(
      /invalid state/i
    );
    expect(result.current.isAuthenticated).toBe(false);
  });
});
