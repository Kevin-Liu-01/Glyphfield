'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ExportProgressState = {
  label: string;
  owner: string;
  progress: number | null;
};

type ExportProgressContextValue = {
  finish: (owner: string) => void;
  start: (owner: string, label: string, progress?: number | null) => void;
  update: (owner: string, progress: number) => void;
};

const ExportProgressContext = createContext<ExportProgressContextValue | null>(null);
const FALLBACK_EXPORT_PROGRESS: ExportProgressContextValue = {
  finish: () => undefined,
  start: () => undefined,
  update: () => undefined,
};

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

export function StudioExportProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ExportProgressState | null>(null);

  const start = useCallback((owner: string, label: string, progress: number | null = null) => {
    setState({ label, owner, progress: progress === null ? null : clampProgress(progress) });
  }, []);

  const update = useCallback((owner: string, progress: number) => {
    setState((current) => current?.owner === owner
      ? { ...current, progress: clampProgress(progress) }
      : current);
  }, []);

  const finish = useCallback((owner: string) => {
    setState((current) => current?.owner === owner ? null : current);
  }, []);

  const value = useMemo(() => ({ finish, start, update }), [finish, start, update]);

  return (
    <ExportProgressContext.Provider value={value}>
      {children}
      {state ? (
        <div
          aria-label={state.label}
          aria-valuemax={state.progress === null ? undefined : 100}
          aria-valuemin={state.progress === null ? undefined : 0}
          aria-valuenow={state.progress === null ? undefined : Math.round(state.progress * 100)}
          className='studio-export-progress'
          data-indeterminate={state.progress === null ? 'true' : 'false'}
          role='progressbar'
        >
          <span style={state.progress === null ? undefined : { width: `${state.progress * 100}%` }} />
        </div>
      ) : null}
    </ExportProgressContext.Provider>
  );
}

export function useStudioExportProgress(owner: string) {
  const context = useContext(ExportProgressContext) ?? FALLBACK_EXPORT_PROGRESS;

  useEffect(() => () => context.finish(owner), [context, owner]);

  return useMemo(() => ({
    finish: () => context.finish(owner),
    start: (label: string, progress?: number | null) => context.start(owner, label, progress),
    update: (progress: number) => context.update(owner, progress),
  }), [context, owner]);
}
