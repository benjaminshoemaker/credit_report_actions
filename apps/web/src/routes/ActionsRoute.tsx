import { useMemo, useState } from 'react';
import type { Action, Warning, AnalyzeFlags, ScoreImpact } from '@shared-schemas';
import { API_BASE_URL } from '../config';
import { useAppState } from '../state/app-state';
import { useAuth } from '../auth/auth-context';
import {
  buildAccountsFromAnalysis,
  buildAnalyzeInput
} from '../utils/analyze-input';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const percent = (value: number) => `${Math.round(value * 100)}%`;

const formatScoreImpact = (impact?: ScoreImpact) => {
  switch (impact) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
};

const buildFlags = (flags: AnalyzeFlags): AnalyzeFlags => ({
  any60dLate: Boolean(flags.any60dLate),
  lateFeeLastTwoStatements: Boolean(flags.lateFeeLastTwoStatements),
  penaltyAprActive: Boolean(flags.penaltyAprActive)
});

const ActionCard = ({ action }: { action: Action }) => {
  const metadata = action.metadata;
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/40 p-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">{action.title}</h3>
        <p className="text-sm text-slate-300">{action.summary}</p>
      </header>
      <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border border-slate-700/60 bg-surface-muted/50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Estimated savings</dt>
          <dd className="text-base font-semibold text-white">
            {currency.format(action.estimatedSavingsUsd)}
            {action.scenarioRange && (
              <span className="ml-2 text-xs font-normal text-slate-300">
                ({currency.format(action.scenarioRange.low)} – {currency.format(action.scenarioRange.high)})
              </span>
            )}
          </dd>
        </div>
        {action.probabilityOfSuccess !== undefined && action.probabilityOfSuccess !== null && (
          <div className="rounded-md border border-slate-700/60 bg-surface-muted/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Probability of success</dt>
            <dd className="text-base font-semibold text-white">{percent(action.probabilityOfSuccess)}</dd>
          </div>
        )}
        {metadata?.cashNeededUsd !== undefined && (
          <div className="rounded-md border border-slate-700/60 bg-surface-muted/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Cash needed</dt>
            <dd className="text-base font-semibold text-white">
              {metadata.cashNeededUsd > 0 ? currency.format(metadata.cashNeededUsd) : 'None'}
            </dd>
          </div>
        )}
        {metadata?.timeToEffectMonths !== undefined && (
          <div className="rounded-md border border-slate-700/60 bg-surface-muted/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Time to effect</dt>
            <dd className="text-base font-semibold text-white">
              ~{metadata.timeToEffectMonths} {metadata.timeToEffectMonths === 1 ? 'month' : 'months'}
            </dd>
          </div>
        )}
        {metadata?.scoreImpact && (
          <div className="rounded-md border border-slate-700/60 bg-surface-muted/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Score impact</dt>
            <dd className="text-base font-semibold text-white">{formatScoreImpact(metadata.scoreImpact)}</dd>
          </div>
        )}
      </dl>
      {metadata?.whyThis && metadata.whyThis.length > 0 && (
        <section className="space-y-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary-foreground">
          <h4 className="text-xs uppercase tracking-wide text-primary-foreground/80">Why this</h4>
          <ul className="list-disc space-y-1 pl-5">
            {metadata.whyThis.map((reason: string, index: number) => (
              <li key={`${action.id}-why-${index}`}>{reason}</li>
            ))}
          </ul>
        </section>
      )}
      {action.nextSteps.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-slate-400">Next steps</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
            {action.nextSteps.map((step: string, index: number) => (
              <li key={`${action.id}-step-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
};

const ActionsRoute = (): JSX.Element => {
  const {
    state: { analysis }
  } = useAppState();
  const { isAuthenticated, accessToken, login } = useAuth();

  const [flags, setFlags] = useState<AnalyzeFlags>({
    any60dLate: false,
    lateFeeLastTwoStatements: false,
    penaltyAprActive: false
  });
  const [actions, setActions] = useState<Action[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const accounts = useMemo(
    () => (analysis ? buildAccountsFromAnalysis(analysis) : []),
    [analysis]
  );

  const handleGenerate = async () => {
    if (!analysis) {
      setError('Upload reports before generating actions.');
      return;
    }

    if (!isAuthenticated) {
      await login('/actions');
      return;
    }

    if (accounts.length === 0) {
      setError('No tradelines available to analyze.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const analyzeInput = buildAnalyzeInput(analysis);
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          ...analyzeInput,
          flags: buildFlags(flags)
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error?.message ?? 'Unable to generate actions. Please try again.'
        );
      }

      const data = await response.json();
      setActions(data.actions ?? []);
      setWarnings(data.warnings ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Generate actions</h1>
        <p className="text-slate-300">
          Upload and review your tradelines first. We need structured fields before estimating
          potential savings.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Action recommendations</h1>
        <p className="text-slate-300">
          Estimate savings and next steps for quick wins. Answers below tailor the odds and expected
          value.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-surface-muted/30 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Quick check-in
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-surface-muted/60"
              checked={Boolean(flags.any60dLate)}
              onChange={(event) =>
                setFlags((prev: AnalyzeFlags) => ({ ...prev, any60dLate: event.target.checked }))
              }
            />
            <span>Any 60+ day late in the last 24 months?</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-surface-muted/60"
              checked={Boolean(flags.lateFeeLastTwoStatements)}
              onChange={(event) =>
                setFlags((prev: AnalyzeFlags) => ({
                  ...prev,
                  lateFeeLastTwoStatements: event.target.checked
                }))
              }
            />
            <span>Late fee charged in the last two statements?</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-surface-muted/60"
              checked={Boolean(flags.penaltyAprActive)}
              onChange={(event) =>
                setFlags((prev: AnalyzeFlags) => ({
                  ...prev,
                  penaltyAprActive: event.target.checked
                }))
              }
            />
            <span>Penalty APR currently active?</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {isLoading ? 'Generating...' : 'Generate actions'}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      {warnings.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Notices</h2>
          <ul className="space-y-1 text-sm text-amber-100">
            {warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        {actions.length === 0 && !isLoading ? (
          <p className="rounded-lg border border-slate-700 bg-surface-muted/40 p-4 text-sm text-slate-300">
            No high-impact actions yet. Try adjusting the quick prompts or ensure balances and limits
            are captured.
          </p>
        ) : (
          actions.map((action) => <ActionCard key={action.id} action={action} />)
        )}
      </section>
    </main>
  );
};

export default ActionsRoute;
