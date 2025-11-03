import { Outlet, Route, Routes, BrowserRouter, Link } from 'react-router-dom';
import LandingRoute from './routes/LandingRoute';
import UploadRoute from './routes/UploadRoute';
import { AppStateProvider } from './state/app-state';
import { AuthProvider, useAuth } from './auth/auth-context';
import AuthCallbackRoute from './routes/AuthCallbackRoute';
import ManualReviewRoute from './routes/ManualReviewRoute';
import ReviewRoute from './routes/ReviewRoute';
import ActionsRoute from './routes/ActionsRoute';
import DisputeLetterPrintRoute from './routes/DisputeLetterPrintRoute';
import SavedRoute from './routes/SavedRoute';

const PageShell = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
    </header>
    {children && <section className="space-y-4 text-slate-300">{children}</section>}
  </main>
);

const PlaceholderRoute = ({ title }: { title: string }) => (
  <PageShell title={title}>
    <p>Coming soon.</p>
  </PageShell>
);

const TermsRoute = () => (
  <PageShell title="Terms of Service">
    <p>
      APRcut is an educational planning tool. We do not pull credit reports or contact issuers
      without your consent. Proceeding indicates you will provide accurate information and will
      review all generated materials before using them.
    </p>
    <ul className="list-disc space-y-2 pl-6">
      <li>All recommendations are informational and not financial advice.</li>
      <li>You are responsible for confirming issuer phone numbers and mailing addresses.</li>
      <li>
        Saved items and uploaded data may be cleared automatically after inactivity in keeping with
        our retention policy.
      </li>
    </ul>
  </PageShell>
);

const PrivacyRoute = () => (
  <PageShell title="Privacy Notice">
    <p>
      Uploaded reports remain on your device until you opt to persist data. When you save items, we
      store only the minimum metadata required to regenerate letters and scripts. Any personal data
      is excluded from the stored payload.
    </p>
    <p>
      We log basic analytics such as browser type and truncated IP address to monitor system
      health. You may request deletion of saved items at any time.
    </p>
  </PageShell>
);

const AppLayout = () => {
  const { isAuthenticated, login, logout } = useAuth();

  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout();
      return;
    }

    const returnPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/';

    void login(returnPath);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-slate-100">
      <header className="border-b border-surface-muted/60 bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            APRcut
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <nav className="flex gap-4">
              <Link to="/upload">Upload</Link>
              <Link to="/saved">Saved</Link>
              <Link to="/actions">Actions</Link>
            </nav>
            <button
              type="button"
              onClick={handleAuthClick}
              className="rounded-md border border-slate-500 px-3 py-1 text-slate-200 transition hover:border-slate-300 hover:text-white"
            >
              {isAuthenticated ? 'Sign out' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
};

const App = (): JSX.Element => (
  <AuthProvider>
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="auth/callback" element={<AuthCallbackRoute />} />
          <Route element={<AppLayout />}>
            <Route index element={<LandingRoute />} />
            <Route path="upload" element={<UploadRoute />} />
            <Route path="review" element={<ReviewRoute />} />
            <Route path="manual-review" element={<ManualReviewRoute />} />
            <Route path="actions" element={<ActionsRoute />} />
            <Route path="actions/*" element={<ActionsRoute />} />
            <Route path="letter/print" element={<DisputeLetterPrintRoute />} />
            <Route path="saved" element={<SavedRoute />} />
            <Route path="tos" element={<TermsRoute />} />
            <Route path="privacy" element={<PrivacyRoute />} />
            <Route path="*" element={<PlaceholderRoute title="Not Found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  </AuthProvider>
);

export default App;
