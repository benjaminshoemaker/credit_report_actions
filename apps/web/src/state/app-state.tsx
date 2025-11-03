import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { Bureau } from '@shared-schemas';
import type { EquifaxParseResult, ParsedAccount } from '../parsing/equifax';
import type { EquifaxMetrics } from '../parsing/analysis';
import type {
  BureauAccount,
  ConflictEntry,
  ReviewAccount
} from '../dedup/cross-bureau';

type ManualEdit = {
  id: string;
  fields: {
    productType: string;
    status: string;
    balance: number;
    creditLimit?: number;
    highCredit?: number;
  };
};

type AnalysisState = {
  source: 'equifax' | 'experian' | 'transunion';
  metrics: EquifaxMetrics;
  requiresManualReview: boolean;
  accounts: ParsedAccount[];
  bureauAccounts: BureauAccount[];
  mergedAccounts: ReviewAccount[];
  excludedAccounts: ReviewAccount[];
  conflicts: ConflictEntry[];
  inquiries: EquifaxParseResult['inquiries'];
  accountsNeedingReview: ParsedAccount[];
  manualEdits: ManualEdit[];
};

type UploadEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  bureau: Bureau | '';
};

type AppState = {
  tosAccepted: boolean;
  uploads: UploadEntry[];
  analysis: AnalysisState | null;
};

type Action =
  | { type: 'setTosAccepted'; value: boolean }
  | { type: 'addFiles'; files: UploadEntry[] }
  | { type: 'updateBureau'; id: string; bureau: Bureau | '' }
  | { type: 'removeFile'; id: string }
  | { type: 'clearUploads' }
  | { type: 'setAnalysis'; value: AnalysisState | null }
  | { type: 'saveManualEdit'; value: ManualEdit };

type AppStateContextValue = {
  state: AppState;
  addFiles: (files: File[]) => void;
  updateBureau: (id: string, bureau: Bureau | '') => void;
  removeFile: (id: string) => void;
  clearUploads: () => void;
  setTosAccepted: (value: boolean) => void;
  setAnalysis: (value: AnalysisState | null) => void;
  saveManualEdit: (value: ManualEdit) => void;
};

const initialState: AppState = {
  tosAccepted: false,
  uploads: [],
  analysis: null
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const createUploadEntry = (file: File): UploadEntry => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`,
  file,
  name: file.name,
  size: file.size,
  bureau: ''
});

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'setTosAccepted':
      return { ...state, tosAccepted: action.value };
    case 'addFiles': {
      const existingKeys = new Set(state.uploads.map((upload) => `${upload.name}-${upload.size}`));
      const nextUploads = [
        ...state.uploads,
        ...action.files.filter((file) => !existingKeys.has(`${file.name}-${file.size}`))
      ];
      return { ...state, uploads: nextUploads };
    }
    case 'updateBureau':
      return {
        ...state,
        uploads: state.uploads.map((upload) =>
          upload.id === action.id ? { ...upload, bureau: action.bureau } : upload
        )
      };
    case 'removeFile':
      return { ...state, uploads: state.uploads.filter((upload) => upload.id !== action.id) };
    case 'clearUploads':
      return { ...state, uploads: [], analysis: null };
    case 'setAnalysis':
      return { ...state, analysis: action.value };
    case 'saveManualEdit':
      if (!state.analysis) return state;
      return {
        ...state,
        analysis: {
          ...state.analysis,
          manualEdits: [...state.analysis.manualEdits.filter((edit) => edit.id !== action.value.id), action.value]
        }
      };
    default:
      return state;
  }
};

export const AppStateProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<AppStateContextValue>(() => ({
    state,
    addFiles: (files: File[]) => {
      if (files.length === 0) return;
      dispatch({ type: 'addFiles', files: files.map((file) => createUploadEntry(file)) });
    },
    updateBureau: (id: string, bureau: Bureau | '') => dispatch({ type: 'updateBureau', id, bureau }),
    removeFile: (id: string) => dispatch({ type: 'removeFile', id }),
    clearUploads: () => dispatch({ type: 'clearUploads' }),
    setTosAccepted: (value: boolean) => dispatch({ type: 'setTosAccepted', value }),
    setAnalysis: (value: AnalysisState | null) => dispatch({ type: 'setAnalysis', value }),
    saveManualEdit: (value: ManualEdit) => dispatch({ type: 'saveManualEdit', value })
  }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = (): AppStateContextValue => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

export type { UploadEntry, ManualEdit, AnalysisState };
