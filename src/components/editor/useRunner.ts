// Runs Rust through src/lib/runner.ts with the user's backend setting and tracks progress.
import { useCallback, useEffect, useRef, useState } from 'react';
import { runRust } from '../../lib/runner';
import { useProgress } from '../../store/progress';
import type { RunMode, RunRequest, RunResult } from '../../types/bridge';

export interface RunnerState {
  running: boolean;
  result: RunResult | null;
  mode: RunMode | null;
  startedAt: number | null;
}

export function useRunner() {
  const [state, setState] = useState<RunnerState>({ running: false, result: null, mode: null, startedAt: null });
  const mounted = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (req: Omit<RunRequest, 'backend'>): Promise<RunResult> => {
    const id = ++seq.current;
    setState((s) => ({ ...s, running: true, mode: req.mode, startedAt: Date.now() }));
    const backend = useProgress.getState().settings.runner;
    let result: RunResult;
    try {
      result = await runRust({ ...req, backend });
    } catch (e) {
      result = {
        ok: false,
        stdout: '',
        stderr: '',
        compileError: false,
        timedOut: false,
        durationMs: 0,
        backend: window.rusteach ? 'local' : 'online',
        infraError: `Kod çalıştırılamadı: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (mounted.current && id === seq.current) {
      setState({ running: false, result, mode: req.mode, startedAt: null });
    }
    return result;
  }, []);

  const clear = useCallback(() => {
    seq.current++;
    setState({ running: false, result: null, mode: null, startedAt: null });
  }, []);

  return { ...state, run, clear };
}

/** True when runs will most likely go to the online Rust Playground (slower first run). */
export function likelyOnline(): boolean {
  const pref = useProgress.getState().settings.runner;
  return !window.rusteach || pref === 'online';
}

/** Ticks while `active`, returning elapsed ms since `startedAt`. */
export function useElapsed(startedAt: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [active]);
  return active && startedAt ? Math.max(0, now - startedAt) : 0;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1).replace('.', ',')} sn`;
}
