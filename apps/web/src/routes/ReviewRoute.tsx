import type { Bureau } from '@shared-schemas';
import { useMemo } from 'react';
import { useAppState } from '../state/app-state';
import type { ConflictEntry, ReviewAccount } from '../dedup/cross-bureau';

const bureauLabels: Record<Bureau, string> = {
  equifax: 'Equifax',
  experian: 'Experian',
  transunion: 'TransUnion',
  unknown: 'Unknown'
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatCurrency = (value?: number): string => {
  if (typeof value !== 'number') {
    return '—';
  }
  return currencyFormatter.format(value);
};

const conflictFieldLabel: Record<ConflictEntry['field'], string> = {
  balance: 'Balance',
  creditLimit: 'Credit limit',
  highCredit: 'High credit',
  status: 'Status',
  ownership: 'Ownership',
  openDate: 'Open date',
  reportedDate: 'Reported month'
};

const conflictResolutionLabel: Record<ConflictEntry['resolution'], string> = {
  latest: 'Latest report wins',
  tie_balance: 'Tie: kept higher balance',
  tie_limit: 'Tie: kept lower limit'
};

const formatConflictValue = (
  field: ConflictEntry['field'],
  value: string | number | undefined
): string => {
  if (value === undefined || value === null) return '—';
  if (field === 'balance' || field === 'creditLimit' || field === 'highCredit') {
    return currencyFormatter.format(Number(value));
  }
  return String(value);
};

const AccountCard = ({ account }: { account: ReviewAccount }) => {
  const bureauList = account.bureaus.map((bureau) => bureauLabels[bureau] ?? bureau);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-white">{account.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span>{bureauList.join(' • ')}</span>
            {account.reportedDate && (
              <span className="text-slate-400">Reported {account.reportedDate}</span>
            )}
            {account.status && <span className="text-slate-400">Status {account.status}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-white">{formatCurrency(account.balance)}</p>
          <p className="text-xs text-slate-400">
            Limit {formatCurrency(account.creditLimit)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {account.ownership === 'joint' && (
          <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-medium text-primary-foreground">
            Joint
          </span>
        )}
      </div>
    </div>
  );
};

const ConflictsPanel = ({ conflicts }: { conflicts: ConflictEntry[] }) => {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Conflicts</h2>
      {conflicts.map((conflict, index) => (
        <div key={`${conflict.accountName}-${conflict.field}-${index}`} className="space-y-1">
          <p className="text-sm text-white">
            <span className="font-semibold">{conflict.accountName}</span>{' '}
            <span className="text-slate-300">({conflictFieldLabel[conflict.field]})</span>
          </p>
          <p className="text-xs text-slate-200">
            Keeping {bureauLabels[conflict.chosen.bureau]}{' '}
            {formatConflictValue(conflict.field, conflict.chosen.value)} —{' '}
            {conflictResolutionLabel[conflict.resolution]}
          </p>
          {conflict.others.length > 0 && (
            <ul className="ml-3 list-disc space-y-1 text-xs text-slate-300">
              {conflict.others.map((other, otherIndex) => (
                <li key={`${conflict.accountName}-${conflict.field}-other-${otherIndex}`}>
                  {bureauLabels[other.bureau]} reported{' '}
                  {formatConflictValue(conflict.field, other.value)}
                  {other.reportedDate ? ` (${other.reportedDate})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
};

const ReviewRoute = (): JSX.Element => {
  const {
    state: { analysis }
  } = useAppState();

  const hasAnalysis = Boolean(analysis);

  const summary = useMemo(() => {
    if (!analysis) return null;
    const { coveragePercent, numericExactPercent, categoricalDatePercent } = analysis.metrics;
    return `Coverage ${coveragePercent.toFixed(
      1
    )}% · Numeric exact ${numericExactPercent.toFixed(
      1
    )}% · Categorical/date ${categoricalDatePercent.toFixed(1)}%`;
  }, [analysis]);
  const coverageBanner = useMemo(() => {
    if (!analysis) return null;
    const uniqueBureaus = new Set(
      analysis.bureauAccounts.map((account) => account.bureau)
    );
    const count = uniqueBureaus.size;
    if (count >= 3) return null;
    return `Using ${count}/3 bureau reports. Add the remaining bureaus to improve coverage.`;
  }, [analysis]);

  if (!hasAnalysis || !analysis) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Review your tradelines</h1>
        <p className="text-slate-300">Upload a report first to generate merged tradelines.</p>
      </main>
    );
  }

  const { mergedAccounts, excludedAccounts, conflicts } = analysis;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Merged tradelines</h1>
        <p className="text-slate-300">
          We combined matching accounts across bureaus using latest-report wins and conservative
          tie-breaks.
        </p>
        {summary && <p className="text-xs uppercase tracking-wide text-slate-400">{summary}</p>}
        {coverageBanner && (
          <p className="text-xs font-medium text-amber-300">{coverageBanner}</p>
        )}
      </header>

      <section className="flex flex-col gap-4">
        {mergedAccounts.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-surface-muted/40 p-4 text-sm text-slate-300">
            No tradelines available. Upload additional bureau reports to see merged accounts.
          </p>
        ) : (
          mergedAccounts.map((account) => <AccountCard key={account.id} account={account} />)
        )}
      </section>

      <ConflictsPanel conflicts={conflicts} />

      {excludedAccounts.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/30 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Excluded accounts
          </h2>
          <p className="text-xs text-slate-400">
            Authorized-user lines are excluded from action planning but kept for reference.
          </p>
          <ul className="space-y-2">
            {excludedAccounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-4 rounded-md border border-slate-700/60 bg-surface-muted/50 px-3 py-2 text-sm text-slate-200"
              >
                <span>{account.name}</span>
                <span className="text-xs text-slate-400">
                  {account.bureaus.map((bureau) => bureauLabels[bureau]).join(' • ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default ReviewRoute;
