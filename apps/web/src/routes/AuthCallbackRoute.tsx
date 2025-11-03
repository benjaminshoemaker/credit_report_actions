import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

const AuthCallbackRoute = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error_description') ?? params.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!code || !state) {
      setError('Missing authorization parameters.');
      return;
    }

    let isActive = true;

    completeLogin(code, state)
      .then(({ returnPath }) => {
        if (isActive) {
          navigate(returnPath ?? '/', { replace: true });
        }
      })
      .catch((err) => {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Authentication failed.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [completeLogin, location.search, navigate]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Authentication failed</h1>
        <p className="text-slate-300">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Signing you in…</h1>
      <p className="text-slate-300">Please wait while we complete your login.</p>
    </main>
  );
};

export default AuthCallbackRoute;
