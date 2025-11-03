import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, type ManualEdit } from '../state/app-state';

const ManualReviewRoute = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    state: { analysis },
    saveManualEdit
  } = useAppState();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accounts = analysis?.accountsNeedingReview ?? [];
  const manualEditMap = useMemo(() => {
    if (!analysis) return new Map<string, ManualEdit>();
    return new Map(analysis.manualEdits.map((edit) => [edit.id, edit] as const));
  }, [analysis]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!analysis) return;

    const formData = new FormData(event.currentTarget);
    let hasError = false;
    const newErrors: Record<string, string> = {};
    const edits: ManualEdit[] = [];

    accounts.forEach((account) => {
      const prefix = account.name;
      const productType = formData.get(`${prefix}-productType`)?.toString().trim() ?? '';
      const status = formData.get(`${prefix}-status`)?.toString().trim() ?? '';
      const balanceRaw = formData.get(`${prefix}-balance`);
      const balance =
        typeof balanceRaw === 'string' && balanceRaw.trim() !== '' ? Number(balanceRaw) : NaN;
      const creditLimitRaw = formData.get(`${prefix}-creditLimit`);
      const highCreditRaw = formData.get(`${prefix}-highCredit`);
      const creditLimit = creditLimitRaw ? Number(creditLimitRaw) : undefined;
      const highCredit = highCreditRaw ? Number(highCreditRaw) : undefined;

      if (!productType || !status || Number.isNaN(balance)) {
        newErrors[prefix] = 'Gate B: add product type, status, and balance for each account.';
        hasError = true;
        return;
      }

      if ((creditLimit === undefined || Number.isNaN(creditLimit)) && (highCredit === undefined || Number.isNaN(highCredit))) {
        newErrors[prefix] = 'Provide either credit limit or high credit.';
        hasError = true;
        return;
      }

      edits.push({
        id: account.name,
        fields: {
          productType,
          status,
          balance,
          creditLimit: Number.isNaN(creditLimit ?? NaN) ? undefined : creditLimit,
          highCredit: Number.isNaN(highCredit ?? NaN) ? undefined : highCredit
        }
      });
    });

    setErrors(newErrors);
    if (hasError) return;

    edits.forEach((edit) => saveManualEdit(edit));
    navigate('/review');
  };

  const hasAnalysis = Boolean(analysis);

  const metricsMessage = useMemo(() => {
    if (!analysis) return 'No analysis available. Upload a report first.';
    const { coveragePercent, numericExactPercent, categoricalDatePercent } = analysis.metrics;
    return `Coverage ${coveragePercent.toFixed(
      1
    )}%, Numeric exact ${numericExactPercent.toFixed(
      1
    )}%, Categorical/date ${categoricalDatePercent.toFixed(1)}%`;
  }, [analysis]);

  if (!hasAnalysis) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Manual review required</h1>
        <p className="text-slate-300">Upload a report on the previous step to start manual review.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Manual review</h1>
        <p className="text-slate-300">Some accounts need extra details. Provide the required fields to continue.</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">{metricsMessage}</p>
      </header>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-surface-muted/30 p-4 text-sm text-slate-300">
            We could not confidently extract the required Gate B fields. Please re-upload your report or contact support.
          </p>
        ) : (
          accounts.map((account) => {
            const existing = manualEditMap.get(account.name);
            const defaultBalance =
              existing?.fields.balance ?? (typeof account.balance === 'number' ? account.balance : '');
            const defaultCreditLimit =
              existing?.fields.creditLimit ??
              (typeof account.creditLimit === 'number' ? account.creditLimit : '');
            const defaultHighCredit =
              existing?.fields.highCredit ??
              (typeof account.highCredit === 'number' ? account.highCredit : '');

            return (
              <fieldset
                key={account.name}
                className="space-y-4 rounded-lg border border-slate-700 bg-surface-muted/40 p-4"
              >
                <legend className="px-2 text-sm font-semibold text-white">{account.name}</legend>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Product type
                    <input
                      name={`${account.name}-productType`}
                      className="rounded border border-slate-700 bg-surface p-2 text-slate-100"
                      defaultValue={existing?.fields.productType ?? 'Revolving'}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Status
                    <input
                      name={`${account.name}-status`}
                      className="rounded border border-slate-700 bg-surface p-2 text-slate-100"
                      defaultValue={
                        existing?.fields.status ?? account.status?.replace(/_/g, ' ') ?? ''
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Balance
                    <input
                      name={`${account.name}-balance`}
                      type="number"
                      min={0}
                      step="0.01"
                      className="rounded border border-slate-700 bg-surface p-2 text-slate-100"
                      defaultValue={defaultBalance}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Credit limit
                    <input
                      name={`${account.name}-creditLimit`}
                      type="number"
                      min={0}
                      step="0.01"
                      className="rounded border border-slate-700 bg-surface p-2 text-slate-100"
                      defaultValue={defaultCreditLimit}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    High credit
                    <input
                      name={`${account.name}-highCredit`}
                      type="number"
                      min={0}
                      step="0.01"
                      className="rounded border border-slate-700 bg-surface p-2 text-slate-100"
                      defaultValue={defaultHighCredit}
                    />
                  </label>
                </div>
                {errors[account.name] && (
                  <p className="text-sm text-danger">{errors[account.name]}</p>
                )}
              </fieldset>
            );
          })
        )}

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Save and continue
          </button>
        </div>
      </form>
    </main>
  );
};

export default ManualReviewRoute;
