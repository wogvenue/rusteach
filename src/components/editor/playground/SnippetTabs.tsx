// Editor-style file tabs for playground snippets: select, rename (double-click or F2), close, add.
import { useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { FileCode2, Plus, X } from 'lucide-react';
import type { Snippet } from './useSnippets';

export default function SnippetTabs({
  snippets,
  activeId,
  onSelect,
  onClose,
  onRename,
  onAdd,
}: {
  snippets: Snippet[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusTab = (i: number) => {
    const s = snippets[(i + snippets.length) % snippets.length];
    onSelect(s.id);
    tabs.current[s.id]?.focus();
  };

  const onKey = (e: KeyboardEvent, i: number, id: string) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(i - 1);
    } else if (e.key === 'F2') {
      e.preventDefault();
      setEditing(id);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onClose(id);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto pl-2 pt-2 soft-scroll" role="tablist" aria-label="Kod dosyaları">
      {snippets.map((s, i) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            className={clsx(
              'group/tab relative flex h-9 max-w-[13rem] shrink-0 items-center rounded-t-xl border border-b-0 pl-3 pr-1 text-[0.8rem] transition-colors',
              active
                ? 'border-[var(--code-border)] bg-[var(--code-bg)] text-fg'
                : 'border-transparent text-muted hover:bg-[color-mix(in_srgb,var(--code-bg)_60%,transparent)] hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId="pg-tab-accent"
                className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden="true"
              />
            )}
            <FileCode2 className={clsx('mr-1.5 size-3.5 shrink-0', active ? 'text-accent' : 'text-subtle')} aria-hidden="true" />
            {editing === s.id ? (
              <input
                autoFocus
                defaultValue={s.name}
                aria-label="Dosya adı"
                className="w-32 rounded-md border border-accent/60 bg-surface px-1.5 py-0.5 font-mono text-[0.78rem] text-fg outline-none"
                onFocus={(e) => e.currentTarget.setSelectionRange(0, e.currentTarget.value.replace(/\.rs$/, '').length)}
                onBlur={(e) => {
                  onRename(s.id, e.currentTarget.value);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    e.currentTarget.value = s.name;
                    e.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <button
                ref={(el) => {
                  tabs.current[s.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(s.id)}
                onDoubleClick={() => setEditing(s.id)}
                onKeyDown={(e) => onKey(e, i, s.id)}
                title={`${s.name} (yeniden adlandırmak için çift tıkla ya da F2)`}
                className="min-w-0 truncate font-mono outline-none focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                {s.name}
              </button>
            )}
            <button
              type="button"
              onClick={() => onClose(s.id)}
              tabIndex={-1}
              className={clsx(
                'ml-1 grid size-6 shrink-0 place-items-center rounded-md text-subtle transition hover:bg-surface-2 hover:text-fg',
                active ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100',
              )}
              aria-label={`${s.name} dosyasını kapat`}
              title="Kapat"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="mb-0.5 ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Yeni dosya"
        title="Yeni dosya"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
