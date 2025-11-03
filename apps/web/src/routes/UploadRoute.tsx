import { Fragment, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Bureau as SharedBureau } from '@shared-schemas';
import { useAppState, type UploadEntry } from '../state/app-state';
import { analyzeBetaDocument } from '../parsing/beta';
import { analyzeEquifaxDocument, type Bureau as SourceBureau } from '../parsing/analysis';
import { mergeCrossBureauAccounts } from '../dedup/cross-bureau';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const bureaus: Array<{ value: SourceBureau; label: string }> = [
  { value: 'equifax', label: 'Equifax' },
  { value: 'experian', label: 'Experian' },
  { value: 'transunion', label: 'TransUnion' }
];

const formatSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
};

const UploadRoute = (): JSX.Element => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { state, addFiles, updateBureau, removeFile, clearUploads, setAnalysis } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');

  const missingBureauIds = useMemo(
    () => new Set(state.uploads.filter((upload) => !upload.bureau).map((upload) => upload.id)),
    [state.uploads]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const invalid = files.find((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return !isPdf || file.size > MAX_FILE_BYTES;
    });

    if (invalid) {
      setError('Only PDF uploads up to 20MB are supported.');
      event.target.value = '';
      return;
    }

    setError(null);
    addFiles(files);
    event.target.value = '';
  };

  const handleReset = () => {
    clearUploads();
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    removeFile(id);
    setError(null);
  };

  const handleAnalyze = () => {
    if (missingBureauIds.size > 0) {
      setError('Assign a bureau to each upload before continuing.');
      return;
    }

    const trimmed = reportText.trim();
    if (!trimmed) {
      setError('Paste the Equifax text before continuing.');
      return;
    }

    const source: SourceBureau =
      state.uploads.length > 0 && state.uploads[0]?.bureau && state.uploads[0]?.bureau !== 'unknown'
        ? (state.uploads[0].bureau as SourceBureau)
        : 'equifax';

    const analysis = source === 'equifax'
      ? analyzeEquifaxDocument(trimmed)
      : analyzeBetaDocument(source, trimmed);

    const bureauAccounts = analysis.accounts.map((account) => ({
      ...account,
      bureau: source
    }));
    const mergeResult = mergeCrossBureauAccounts(bureauAccounts);
    setAnalysis({
      source,
      metrics: analysis.metrics,
      requiresManualReview: analysis.requiresManualReview,
      accounts: analysis.accounts,
      bureauAccounts,
      mergedAccounts: mergeResult.mergedAccounts,
      excludedAccounts: mergeResult.excludedAccounts,
      conflicts: mergeResult.conflicts,
      inquiries: analysis.inquiries,
      accountsNeedingReview: analysis.accountsNeedingReview,
      manualEdits: []
    });

    if (analysis.requiresManualReview) {
      navigate('/manual-review');
    } else {
      navigate('/review');
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <section className="flex flex-col gap-4 rounded-xl bg-surface p-8 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">Upload your credit report</h1>
          <p className="text-slate-300">
            Provide the bureau for each file so we can merge accounts correctly. We currently
            support PDFs up to 20MB.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="file-upload"
            className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-600 bg-surface-muted/40 p-6 text-sm text-slate-300"
          >
            <span className="font-semibold text-white">Select reports</span>
            <span>Accepted format: PDF (≤20MB). You can upload multiple files at once.</span>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileChange}
              className="mt-2 text-slate-200"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="report-text" className="text-sm font-semibold text-white">
            Paste Equifax text
          </label>
          <textarea
            id="report-text"
            className="h-48 w-full rounded-md border border-slate-700 bg-surface p-3 text-sm text-slate-100"
            value={reportText}
            onChange={(event) => setReportText(event.target.value)}
            placeholder="Paste the text contents of your Equifax report here for the MVP parser."
          />
        </div>

        {state.uploads.length > 0 ? (
          <div className="flex flex-col gap-4">
            {state.uploads.map((upload: UploadEntry) => (
              <Fragment key={upload.id}>
                <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{upload.name}</span>
                      <span className="text-xs text-slate-400">{formatSize(upload.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(upload.id)}
                      className="text-sm text-slate-400 hover:text-slate-200"
                    >
                      Remove
                    </button>
                  </div>
                  <label className="flex flex-col gap-2 text-sm text-slate-200">
                    <span>Bureau</span>
                    <select
                      className="w-full rounded border border-slate-600 bg-surface p-2 text-slate-100"
                      value={upload.bureau}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateBureau(upload.id, value === '' ? '' : (value as SharedBureau));
                      }}
                    >
                      <option value="">Select bureau</option>
                      {bureaus.map((bureau) => (
                        <option key={bureau.value} value={bureau.value}>
                          {bureau.label}
                        </option>
                      ))}
                    </select>
                    {missingBureauIds.has(upload.id) && (
                      <span className="text-xs text-danger">Select a bureau before continuing.</span>
                    )}
                  </label>
                </div>
              </Fragment>
            ))}
            <div className="flex items-center justify-end gap-3 text-sm">
              <button
                type="button"
                onClick={handleReset}
                className="text-slate-400 hover:text-slate-200"
              >
                Clear all
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-slate-700 bg-surface-muted/30 p-4 text-sm text-slate-300">
            No files uploaded yet.
          </p>
        )}

        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled={missingBureauIds.size > 0}
            onClick={handleAnalyze}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Continue to review
          </button>
        </div>
      </section>
    </main>
  );
};

export default UploadRoute;
