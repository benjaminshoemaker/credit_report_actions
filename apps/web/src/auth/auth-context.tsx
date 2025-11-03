import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  COGNITO_CLIENT_ID,
  COGNITO_DOMAIN,
  COGNITO_REDIRECT_URI,
  COGNITO_SCOPE,
  DEV_AUTH_MODE
} from '../config';
import {
  AUTH_SESSION_KEY,
  clearAuthSession,
  loadAuthSession,
  saveAuthSession
} from './storage';
import {
  createCodeChallenge,
  createCodeVerifier,
  createNonce,
  createStateParam
} from './pkce';

type Tokens = {
  accessToken: string;
  idToken: string;
  expiresAt: number;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  accessToken: string | null;
  idToken: string | null;
  expiresAt: number | null;
  login: (returnPath?: string) => Promise<void>;
  logout: () => void;
  completeLogin: (code: string, state: string) => Promise<{ returnPath: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const MAX_SESSION_MS = 60 * 60 * 1000; // 60 minutes

const createDevTokens = (): Tokens => ({
  accessToken: 'dev-access-token',
  idToken: 'dev-id-token',
  expiresAt: Date.now() + MAX_SESSION_MS
});

const createAuthorizeUrl = async (
  returnPath: string | undefined
): Promise<{ authorizeUrl: string; state: string }> => {
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = createStateParam();
  const nonce = createNonce();

  saveAuthSession({
    state,
    codeVerifier: verifier,
    nonce,
    returnPath
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: COGNITO_REDIRECT_URI,
    scope: COGNITO_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    nonce
  });

  const authorizeUrl = `${COGNITO_DOMAIN.replace(/\/$/, '')}/oauth2/authorize?${params.toString()}`;
  return { authorizeUrl, state };
};

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [tokens, setTokens] = useState<Tokens | null>(() =>
    DEV_AUTH_MODE ? createDevTokens() : null
  );
  const expiryTimer = useRef<number | null>(null);

  const clearTokens = useCallback(() => {
    setTokens(null);
  }, []);

  useEffect(() => {
    if (expiryTimer.current) {
      window.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }

    if (tokens) {
      const msUntilExpiry = Math.max(tokens.expiresAt - Date.now(), 0);
      expiryTimer.current = window.setTimeout(() => {
        setTokens(null);
      }, msUntilExpiry);
    }

    return () => {
      if (expiryTimer.current) {
        window.clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
    };
  }, [tokens]);

  const login = useCallback(async (returnPath?: string) => {
    if (DEV_AUTH_MODE) {
      setTokens(createDevTokens());
      return;
    }
    const targetPath =
      returnPath ??
      (typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/');
    const { authorizeUrl } = await createAuthorizeUrl(targetPath);
    window.location.assign(authorizeUrl);
  }, [setTokens]);

  const logout = useCallback(() => {
    clearAuthSession();
    clearTokens();
  }, [clearTokens]);

  const completeLogin = useCallback(
    async (code: string, state: string) => {
      const session = loadAuthSession();
      if (!session || session.state !== state) {
        clearAuthSession();
        throw new Error('Invalid state. Please try signing in again.');
      }

      if (DEV_AUTH_MODE) {
        setTokens(createDevTokens());
        clearAuthSession();
        return { returnPath: session.returnPath ?? '/' };
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: COGNITO_CLIENT_ID,
        code,
        redirect_uri: COGNITO_REDIRECT_URI,
        code_verifier: session.codeVerifier
      });

      const response = await fetch(
        `${COGNITO_DOMAIN.replace(/\/$/, '')}/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      );

      if (!response.ok) {
        clearAuthSession();
        throw new Error('Authentication failed. Please try again.');
      }

      const data = await response.json();
      if (!data.access_token || !data.id_token) {
        clearAuthSession();
        throw new Error('Authentication response was missing tokens.');
      }

      const expiresInSeconds = Math.min(
        Number(data.expires_in ?? MAX_SESSION_MS / 1000),
        MAX_SESSION_MS / 1000
      );
      const expiresAt = Date.now() + expiresInSeconds * 1000;

      setTokens({
        accessToken: data.access_token,
        idToken: data.id_token,
        expiresAt
      });

      clearAuthSession();
      return { returnPath: session.returnPath ?? '/' };
    },
    [setTokens]
  );

  const contextValue = useMemo<AuthContextValue>(() => {
    const isAuthenticated = Boolean(tokens && tokens.expiresAt > Date.now());
    return {
      isAuthenticated,
      accessToken: isAuthenticated ? tokens?.accessToken ?? null : null,
      idToken: isAuthenticated ? tokens?.idToken ?? null : null,
      expiresAt: tokens?.expiresAt ?? null,
      login,
      logout,
      completeLogin
    };
  }, [tokens, login, logout, completeLogin]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AUTH_SESSION_KEY };
