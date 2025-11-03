import { useEffect, useState } from 'react';
import type { AnalyzeInput } from '@shared-schemas';
import { API_BASE_URL } from '../config';
import { useAuth } from '../auth/auth-context';
import { useAppState } from '../state/app-state';
import { buildAnalyzeInput, LOCAL_USER_ID } from '../utils/analyze-input';

type SavedItem = {
  item_id: string;
  type: string;
  template_id: string;
  payload_no_pii: {
    analyzeInput?: AnalyzeInput;
    letterHtml?: string;
    script?: string;
    generatedAt?: string;
  };
  engine_version: string;
  created_at: string;
  updated_at: string;
  stale: boolean;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const SavedRoute = (): JSX.Element => {
  const {
    state: { analysis }
  } = useAppState();
  const { isAuthenticated, accessToken, login } = useAuth();

  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/items?user_id=${encodeURIComponent(LOCAL_USER_ID)}`,
        {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          }
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Unable to load saved items.');
      }

      const data = await response.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load saved items.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerate = async (item: SavedItem) => {
    if (!isAuthenticated) {
      await login('/saved');
      return;
    }

    if (!item.payload_no_pii?.analyzeInput) {
      setError('Cannot regenerate this item because the original input was not saved.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const analysisPayload = item.payload_no_pii.analyzeInput;
      const analyzeResponse = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(analysisPayload)
      });

      if (!analyzeResponse.ok) {
        const data = await analyzeResponse.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Regeneration failed.');
      }

      const analyzeData = await analyzeResponse.json();
      const nextEngineVersion = analyzeData.audit?.engineVersion ?? item.engine_version;

      await fetch(`${API_BASE_URL.replace(/\/$/, '')}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          user_id: LOCAL_USER_ID,
          type: item.type,
          template_id: item.template_id,
          payload_no_pii: {
            ...item.payload_no_pii,
            regeneratedAt: new Date().toISOString()
          },
          engine_version: nextEngineVersion
        })
      });

      await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/items/${encodeURIComponent(item.item_id)}?user_id=${encodeURIComponent(LOCAL_USER_ID)}`,
        {
          method: 'DELETE',
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          }
        }
      );

      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshFromAnalysis = async () => {
    if (!analysis) {
      setError('Upload and analyze a report before refreshing items.');
      return;
    }

    if (!isAuthenticated) {
      await login('/saved');
      return;
    }

    const analyzeInput = buildAnalyzeInput(analysis);
    await fetchItems();
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        payload_no_pii: {
          ...item.payload_no_pii,
          analyzeInput
        }
      }))
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Saved items</h1>
        <p className="text-slate-300">
          Scripts and letters you save appear here. Regenerate stale items after a fresh analysis run.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchItems()}
            className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200 transition hover:border-slate-400 hover:text-white"
            disabled={isLoading}
          >
            Refresh list
          </button>
          <button
            type="button"
            onClick={() => void handleRefreshFromAnalysis()}
            className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200 transition hover:border-slate-400 hover:text-white"
            disabled={isLoading}
          >
            Attach latest analysis
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </header>

      {isLoading && (
        <p className="text-sm text-slate-300">Loading saved items…</p>
      )}

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.item_id}
            className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-surface-muted/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  {item.type.toUpperCase()}
                </span>
                <span className="text-xs text-slate-400">
                  Template: {item.template_id} · Saved {formatDate(item.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {item.stale && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-300">
                    Stale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleRegenerate(item)}
                  className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-400 hover:text-white"
                >
                  Regenerate
                </button>
              </div>
            </div>
            {item.payload_no_pii?.letterHtml && (
              <p className="text-xs text-slate-400">
                Letter preview saved at {item.payload_no_pii.generatedAt ?? 'unknown'}.
              </p>
            )}
            {item.payload_no_pii?.script && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-slate-700/50 bg-surface-muted/60 p-3 text-xs text-slate-200">
                {item.payload_no_pii.script}
              </pre>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && !isLoading && (
        <p className="rounded-lg border border-slate-700 bg-surface-muted/30 p-4 text-sm text-slate-300">
          No saved items yet. Generate a letter or script and use the save buttons to store them here.
        </p>
      )}
    </main>
  );
};

export default SavedRoute;

