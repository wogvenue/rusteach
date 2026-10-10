// Playground snippets (tabs), persisted per device in localStorage under "rusteach-playground".
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CODE } from './templates';

const KEY = 'rusteach-playground';

export interface Snippet {
  id: string;
  name: string;
  code: string;
}

interface Stored {
  snippets: Snippet[];
  activeId: string;
  split: number; // editor width ratio 0.3..0.75
  stdin: string;
}

const newId = () => Math.random().toString(36).slice(2, 10);

function initial(): Stored {
  const first = { id: newId(), name: 'main.rs', code: DEFAULT_CODE };
  return { snippets: [first], activeId: first.id, split: 0.58, stdin: '' };
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const p = JSON.parse(raw) as Partial<Stored>;
    const snippets = Array.isArray(p.snippets)
      ? p.snippets.filter((s): s is Snippet => !!s && typeof s.id === 'string' && typeof s.code === 'string' && typeof s.name === 'string')
      : [];
    if (!snippets.length) return initial();
    return {
      snippets,
      activeId: snippets.some((s) => s.id === p.activeId) ? (p.activeId as string) : snippets[0].id,
      split: typeof p.split === 'number' ? clampSplit(p.split) : 0.58,
      stdin: typeof p.stdin === 'string' ? p.stdin : '',
    };
  } catch {
    return initial();
  }
}

export const clampSplit = (v: number) => Math.min(0.75, Math.max(0.3, v));

/** "yeni.rs" -> "yeni-2.rs" when taken. */
function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  const m = /^(.*?)(\.rs)?$/.exec(base);
  const stem = m?.[1] ?? base;
  for (let i = 2; ; i++) {
    const n = `${stem}-${i}.rs`;
    if (!taken.includes(n)) return n;
  }
}

export function useSnippets() {
  const [state, setState] = useState<Stored>(load);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable: the playground still works for this session */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const active = state.snippets.find((s) => s.id === state.activeId) ?? state.snippets[0];

  const setCode = useCallback((code: string) => {
    setState((s) => ({ ...s, snippets: s.snippets.map((x) => (x.id === s.activeId ? { ...x, code } : x)) }));
  }, []);

  const select = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), []);

  const add = useCallback((name: string, code: string) => {
    const id = newId();
    setState((s) => ({
      ...s,
      snippets: [...s.snippets, { id, name: uniqueName(name, s.snippets.map((x) => x.name)), code }],
      activeId: id,
    }));
    return id;
  }, []);

  const rename = useCallback((id: string, name: string) => {
    let clean = name.trim().replace(/[\\/:*?"<>|]/g, '');
    if (!clean) return;
    if (!clean.endsWith('.rs')) clean += '.rs';
    setState((s) => ({
      ...s,
      snippets: s.snippets.map((x) =>
        x.id === id ? { ...x, name: uniqueName(clean, s.snippets.filter((y) => y.id !== id).map((y) => y.name)) } : x,
      ),
    }));
  }, []);

  const close = useCallback((id: string) => {
    setState((s) => {
      if (s.snippets.length === 1) {
        const fresh = { id: newId(), name: 'main.rs', code: DEFAULT_CODE };
        return { ...s, snippets: [fresh], activeId: fresh.id };
      }
      const idx = s.snippets.findIndex((x) => x.id === id);
      const snippets = s.snippets.filter((x) => x.id !== id);
      const activeId = s.activeId === id ? snippets[Math.max(0, idx - 1)].id : s.activeId;
      return { ...s, snippets, activeId };
    });
  }, []);

  const setSplit = useCallback((v: number) => setState((s) => ({ ...s, split: clampSplit(v) })), []);
  const setStdin = useCallback((stdin: string) => setState((s) => ({ ...s, stdin })), []);

  return { ...state, active, setCode, select, add, rename, close, setSplit, setStdin };
}
