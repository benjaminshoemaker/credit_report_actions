const DEFAULT_DOMAIN = 'https://example.auth.us-east-1.amazoncognito.com';
const DEFAULT_CLIENT_ID = 'test-client-id';
const DEFAULT_REDIRECT_URI = 'http://localhost:5173/auth/callback';
const DEFAULT_SCOPE = 'openid profile email';
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const isTruthy = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

export const COGNITO_DOMAIN =
  import.meta.env?.VITE_COGNITO_DOMAIN ?? DEFAULT_DOMAIN;
export const COGNITO_CLIENT_ID =
  import.meta.env?.VITE_COGNITO_CLIENT_ID ?? DEFAULT_CLIENT_ID;
export const COGNITO_REDIRECT_URI =
  import.meta.env?.VITE_COGNITO_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;
export const COGNITO_SCOPE =
  import.meta.env?.VITE_COGNITO_SCOPE ?? DEFAULT_SCOPE;
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
export const DEV_AUTH_MODE = isTruthy(import.meta.env?.VITE_DEV_AUTH);
