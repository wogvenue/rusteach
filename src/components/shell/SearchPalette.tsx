// Global search palette (Ctrl+K / Cmd+K): lessons, modules, glossary, compiler errors and pages.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { BookA, Bug, CornerDownLeft, FileText, Layers, Lock, Search, Compass } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Kbd } from '../ui/primitives';
import { lessonStatus, useProgress } from '../../store/progress';
import { useUi } from '../../store/ui';
import { fold, queryWords, quickPages, search, type SearchHit, type SearchKind } from '../../lib/search';

const KIND: Record<SearchKind, { label: string; icon: typeof Search }> = {
  sayfa: { label: 'Sayfa', icon: Compass },
  modul: { label: 'Modül', icon: Layers },
  ders: { label: 'Ders', icon: FileText },
  sozluk: { label: 'Sözlük', icon: BookA },
  hata: { label: 'Hata', icon: Bug },
};

/** Wraps the matched words in <mark>. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const lower = fold(text);
  if (lower.length !== text.length) return <>{text}</>;
  const ranges: [number, number][] = [];
  for (const w of words) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(w, from);
      if (at < 0) break;
      ranges.push([at, at + w.length]);
      from = at + w.length;
    }
  }
  if (!ranges.length) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const parts: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(([s, e], i) => {
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark key={i} className="rounded-sm bg-[color-mix(in_oklab,var(--c-accent)_28%,transparent)] px-px text-fg">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}

export default function SearchPalette() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);

  // Ctrl+K / Cmd+K toggles from anywhere (also inside the code editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        useUi.getState().setSearchOpen(!useUi.getState().searchOpen);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} label="Ara" showClose={false} className="mt-[8vh] max-w-[680px] self-start overflow-hidden">
      <PaletteBody onDone={() => setOpen(false)} />
    </Dialog>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const progress = useProgress();

  const words = useMemo(() => queryWords(deferred), [deferred]);
  const hits = useMemo<SearchHit[]>(() => (words.length ? search(deferred) : quickPages()), [deferred, words.length]);

  useEffect(() => setActive(0), [deferred]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const locked = (h: SearchHit) => !!h.lessonId && lessonStatus(progress, h.lessonId) === 'locked';

  const go = (h: SearchHit) => {
    // A locked lesson cannot be opened; take the learner to its module instead.
    const to = locked(h) && h.moduleId ? `/modul/${h.moduleId}` : h.to;
    onDone();
    navigate(to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-border px-5">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={hits[active] ? `search-hit-${active}` : undefined}
          aria-label="Derslerde, sözlükte ve hata kodlarında ara"
          placeholder="Derslerde, sözlükte, hata kodlarında ara (örn. borrow, E0382, Rc)"
          spellCheck={false}
          autoComplete="off"
          className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-subtle"
        />
        <Kbd>Esc</Kbd>
      </div>

      <ul id="search-results" ref={listRef} role="listbox" aria-label="Arama sonuçları" className="max-h-[min(56vh,460px)] overflow-y-auto p-2">
        {hits.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted">
            “{query.trim()}” için sonuç yok. Daha kısa ya da İngilizce terimle dene (ör. <span className="font-mono">borrow</span>).
          </li>
        )}
        {hits.map((h, i) => {
          const k = KIND[h.kind];
          const Icon = locked(h) ? Lock : k.icon;
          return (
            <li key={h.id} role="presentation">
              <button
                type="button"
                id={`search-hit-${i}`}
                data-i={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => go(h)}
                className={clsx(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                )}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-fg">
                      <Highlight text={h.title} words={words} />
                    </span>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-subtle">
                      {locked(h) ? 'Kilitli · modüle git' : k.label}
                    </span>
                  </span>
                  {h.context && (
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      <Highlight text={h.context} words={words} />
                    </span>
                  )}
                  {h.snippet && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                      <Highlight text={h.snippet} words={words} />
                    </span>
                  )}
                </span>
                {i === active && <CornerDownLeft className="mt-2 size-4 shrink-0 text-subtle" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-xs text-subtle">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> gez</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> aç</span>
        </span>
        <span>{words.length ? `${hits.length}${hits.length >= 40 ? '+' : ''} sonuç` : 'Yazmaya başla'}</span>
      </div>
    </div>
  );
}
