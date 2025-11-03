import { useMemo, useState } from 'react';
import type { AnalyzeInput } from '@shared-schemas';
import { useAppState } from '../state/app-state';
import { useAuth } from '../auth/auth-context';
import { API_BASE_URL } from '../config';
import {
  buildAnalyzeInput,
  LOCAL_USER_ID
} from '../utils/analyze-input';

const ENGINE_VERSION = 'v1.0.0';

const buildLetterHtml = (analyzeInput: AnalyzeInput | null): string => {
  const primaryAccount = analyzeInput?.accounts[0];
  const accountName = primaryAccount?.creditorName ?? '{{ACCOUNT_NAME}}';
  const disputeField = primaryAccount ? 'Balance reported' : '{{DISPUTED_FIELD}}';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Dispute Letter</title>
    <style>
      body { font-family: 'Times New Roman', serif; color: #101010; line-height: 1.5; padding: 1.5rem; }
      .header { margin-bottom: 1.5rem; }
      .header div { line-height: 1.4; }
      .salutation { margin-top: 1rem; }
      .exhibits { margin-top: 1.5rem; }
      .signature { margin-top: 2rem; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>{{CURRENT_DATE}}</div>
      <div>{{CONSUMER_NAME}}</div>
      <div>{{CONSUMER_ADDRESS_LINE1}}</div>
      <div>{{CONSUMER_ADDRESS_LINE2}}</div>
    </div>
    <div>
      <div>Equifax Information Services LLC</div>
      <div>P.O. Box 740256</div>
      <div>Atlanta, GA 30374</div>
    </div>
    <div class="salutation">
      <p>Re: Investigation Request – ${accountName}</p>
      <p>To whom it may concern:</p>
    </div>
    <p>
      I am writing to dispute the reporting of <strong>${accountName}</strong>. The entry for ${
    accountName
  } appears inaccurate.
      Specifically, ${disputeField} does not align with my records.
    </p>
    <p>
      Under the Fair Credit Reporting Act, please investigate and update this account to reflect complete and accurate data.
      I have highlighted supporting documentation in the enclosed exhibits.
    </p>
    <p>
      Once you complete your investigation, please send confirmation of the outcome to the address listed above.
    </p>
    <div class="exhibits">
      <p>Enclosed exhibits:</p>
      <ul>
        <li>Exhibit A – Recent statement highlighting the disputed entry</li>
        <li>Exhibit B – Payment confirmation dated {{PAYMENT_DATE}}</li>
        <li>Exhibit C – Correspondence with ${accountName}</li>
      </ul>
    </div>
    <div class="signature">
      <p>Sincerely,</p>
      <p>{{CONSUMER_SIGNATURE_LINE}}</p>
    </div>
  </body>
</html>`;
};

const buildScript = (analyzeInput: AnalyzeInput | null): string => {
  const account = analyzeInput?.accounts[0];
  const creditor = account?.creditorName ?? '{{CREDITOR}}';
  const balance = account ? `$${account.balance.toLocaleString()}` : '{{BALANCE}}';
  return [
    `60-Second Call Script – ${creditor}`,
    '',
    'Intro:',
    `"Hi, this is {{CALLER_NAME}}. I'm calling about my ${creditor} account ending in {{ACCOUNT_SUFFIX}}."`,
    '',
    'Talking Points:',
    `1. "I currently carry about ${balance} and want to keep the account in good standing."`,
    '2. "My history has been strong other than this recent blip, and I have autopay set up going forward."',
    '3. "I would like to work with your team on a quick resolution today."',
    '',
    'Ask:',
    '"Could you review the account and confirm the correct information is being reported?"',
    '',
    'Escalation:',
    '"If you are unable to help, may I speak with a supervisor or retention specialist?"'
  ].join('\n');
};

const saveItem = async ({
  token,
  body,
  setStatus
}: {
  token: string | null;
  body: unknown;
  setStatus: (value: { message: string; tone: 'success' | 'error' }) => void;
}) => {
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.message ?? 'Unable to save item.');
    }

    setStatus({ message: 'Saved! Visit the Saved tab to view.', tone: 'success' });
  } catch (error) {
    setStatus({
      message: error instanceof Error ? error.message : 'Save failed. Please try again.',
      tone: 'error'
    });
  }
};

const DisputeLetterPrintRoute = (): JSX.Element => {
  const {
    state: { analysis }
  } = useAppState();
  const { isAuthenticated, accessToken, login } = useAuth();
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const analyzeInput = useMemo<AnalyzeInput | null>(
    () => (analysis ? buildAnalyzeInput(analysis) : null),
    [analysis]
  );

  const letterHtml = useMemo(() => buildLetterHtml(analyzeInput), [analyzeInput]);
  const scriptText = useMemo(() => buildScript(analyzeInput), [analyzeInput]);

  if (!analysis || !analyzeInput) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Dispute letter</h1>
        <p className="text-slate-300">
          Upload and analyze a report first. We need structured tradelines before preparing a letter.
        </p>
      </main>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleSaveLetter = async () => {
    if (!isAuthenticated) {
      await login('/letter/print');
      return;
    }

    await saveItem({
      token: accessToken,
      setStatus,
      body: {
        user_id: LOCAL_USER_ID,
        type: 'letter',
        template_id: 'dispute-style-a',
        payload_no_pii: {
          analyzeInput,
          letterHtml,
          generatedAt: new Date().toISOString()
        },
        engine_version: ENGINE_VERSION
      }
    });
  };

  const handleSaveScript = async () => {
    if (!isAuthenticated) {
      await login('/letter/print');
      return;
    }

    await saveItem({
      token: accessToken,
      setStatus,
      body: {
        user_id: LOCAL_USER_ID,
        type: 'script',
        template_id: 'dispute-call-script',
        payload_no_pii: {
          analyzeInput,
          script: scriptText,
          generatedAt: new Date().toISOString()
        },
        engine_version: ENGINE_VERSION
      }
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Dispute letter</h1>
        <p className="text-slate-300">
          Review the template, print to PDF, or save for later. Script notes are included for call intake teams.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={handleSaveLetter}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Save letter
          </button>
          <button
            type="button"
            onClick={handleSaveScript}
            className="rounded-md border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-300 hover:text-white"
          >
            Save call script
          </button>
        </div>
        {status && (
          <p className={`text-sm ${status.tone === 'success' ? 'text-emerald-400' : 'text-danger'}`}>
            {status.message}
          </p>
        )}
      </header>

      <section className="rounded-lg border border-slate-700 bg-surface-muted/30 p-4 shadow-lg shadow-black/20">
        <iframe
          title="Dispute letter preview"
          className="h-[480px] w-full rounded border border-slate-700 bg-white"
          srcDoc={letterHtml}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Intake call script
        </h2>
        <pre className="whitespace-pre-wrap rounded-md border border-slate-700 bg-surface-muted/60 p-4 text-sm text-slate-200">
          {scriptText}
        </pre>
      </section>
    </main>
  );
};

export default DisputeLetterPrintRoute;

