// "Şablonlar" popover: opens a starter program in a new tab.
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import clsx from 'clsx';
import { Popover } from '../../ui/Popover';
import { TEMPLATES, type PlaygroundTemplate } from './templates';
import { detectCrates } from '../util';

export default function TemplatesMenu({ onPick }: { onPick: (t: PlaygroundTemplate) => void }) {
  return (
    <Popover
      label="Şablonlar"
      align="end"
      panelClassName="w-[19rem] p-1.5"
      trigger={(props, open) => (
        <button
          {...props}
          type="button"
          className={clsx(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            open ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <LayoutTemplate className="size-3.5" aria-hidden="true" />
          <span className="max-md:sr-only">Şablonlar</span>
          <ChevronDown className={clsx('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <ul className="max-h-[min(70vh,28rem)] overflow-y-auto soft-scroll">
          {TEMPLATES.map((t) => {
            const crates = detectCrates(t.code);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(t);
                    close();
                  }}
                  className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                    {t.title}
                    {crates.length > 0 && (
                      <span className="rounded-md bg-info-soft px-1.5 py-px font-mono text-[0.65rem] font-semibold text-info">
                        {crates.join(', ')}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted">{t.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}
