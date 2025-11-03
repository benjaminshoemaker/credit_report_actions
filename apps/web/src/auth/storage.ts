const STORAGE_KEY = 'aprcut_auth_session';

export type AuthSession = {
  state: string;
  codeVerifier: string;
  nonce: string;
  returnPath?: string;
};

export const saveAuthSession = (session: AuthSession): void => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadAuthSession = (): AuthSession | null => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const clearAuthSession = (): void => {
  sessionStorage.removeItem(STORAGE_KEY);
};

export const AUTH_SESSION_KEY = STORAGE_KEY;
