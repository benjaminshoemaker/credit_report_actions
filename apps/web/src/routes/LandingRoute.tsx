import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/app-state';

const LandingRoute = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    state: { tosAccepted },
    setTosAccepted
  } = useAppState();

  const handleProceed = () => {
    if (!tosAccepted) return;
    navigate('/upload');
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <section className="flex flex-col gap-4 rounded-xl bg-surface p-8 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold text-white">Kick off your APRcut analysis</h1>
        <p className="text-slate-300">
          We&apos;ll walk you through uploading your credit report, reviewing the parsed data, and
          surfacing high-impact actions. Before getting started, confirm you&apos;ve reviewed our
          policies.
        </p>
        <label className="flex items-start gap-3 text-slate-200">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-500 bg-surface-muted"
            checked={tosAccepted}
            onChange={(event) => setTosAccepted(event.target.checked)}
            aria-describedby="tos-helper"
          />
          <span>
            I agree to the <a href="/tos">Terms of Service</a> and <a href="/privacy">Privacy Notice</a>.
          </span>
        </label>
        <p id="tos-helper" className="text-sm text-slate-400">
          You must agree before continuing.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleProceed}
            disabled={!tosAccepted}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Continue
          </button>
          <a href="/privacy" className="text-sm text-accent">
            View privacy details
          </a>
        </div>
      </section>
    </main>
  );
};

export default LandingRoute;
