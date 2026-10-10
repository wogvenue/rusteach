// Right side of the playground: run output (terminal) and the stdin box.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDown, Keyboard, Terminal, Trash2 } from 'lucide-react';
import RunOutput from '../RunOutput';
import type { RunnerState } from '../useRunner';
import { Kbd } from '../../ui/primitives';

export default function OutputPane({
  runner,
  onClear,
  stdin,
  onStdin,
  stdinAvailable,
  hasTests,
}: {
  runner: RunnerState;
  hasTests: boolean;
  onClear: () => void;
  stdin: string;
  onStdin: (v: string) => void;
  stdinAvailable: boolean;
}) {
  const [stdinOpen, setStdinOpen] = useState(() => stdin.length > 0);
  const empty = !runner.running && !runner.result;

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-[var(--code-bg-2)]" aria-label="Çıktı">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--code-border)] px-4">
        <Terminal className="size-4 text-subtle" aria-hidden="true" />
        <span className="text-[0.8rem] font-semibold text-fg">Çıktı</span>
        <span className="flex-1" />
        {!empty && !runner.running && (
          <button
            type="button"
            onClick={onClear}
            className="grid size-7 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Çıktıyı temizle"
            title="Çıktıyı temizle"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto soft-scroll">
        {empty ? (
          <div className="grid h-full place-items-center px-6 py-10 text-center">
            <div className="max-w-[17rem]">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-lg text-accent">
                &gt;_
              </div>
              <p className="mt-4 text-sm font-medium text-fg">Programın çıktısı burada görünecek.</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Çalıştırmak için <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
                {hasTests ? (
                  <>
                    , testler için <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd>.
                  </>
                ) : (
                  <>. Test yazmak istersen fonksiyonunun üstüne #[test] ekle.</>
                )}
              </p>
            </div>
          </div>
        ) : (
          <RunOutput
            result={runner.result}
            running={runner.running}
            mode={runner.mode}
            startedAt={runner.startedAt}
            maxHeight="none"
            className="!border-t-0 [&>div:last-child]:!overflow-visible"
          />
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--code-border)]">
        <button
          type="button"
          onClick={() => setStdinOpen((o) => !o)}
          aria-expanded={stdinOpen}
          disabled={!stdinAvailable}
          className="flex h-10 w-full items-center gap-2 px-4 text-left text-[0.8rem] font-semibold text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-default disabled:hover:text-muted"
        >
          <Keyboard className="size-4 text-subtle" aria-hidden="true" />
          Girdi (stdin)
          {stdinAvailable ? (
            <>
              {stdin && !stdinOpen && <span className="truncate font-mono text-[0.72rem] font-normal text-subtle">{stdin.split('\n')[0]}</span>}
              <span className="flex-1" />
              <ChevronDown className={clsx('size-4 transition-transform', stdinOpen && 'rotate-180')} aria-hidden="true" />
            </>
          ) : (
            <span className="ml-auto text-[0.72rem] font-normal text-subtle">yalnızca yerel Rust ile</span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {stdinOpen && stdinAvailable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="overflow-hidden"
            >
              <textarea
                value={stdin}
                onChange={(e) => onStdin(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={'Programın okuyacağı satırlar…\nörneğin: 42'}
                aria-label="Programa verilecek girdi (stdin)"
                className="block w-full resize-none border-0 bg-[var(--code-bg)] px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-[var(--code-fg)] outline-none placeholder:text-[var(--code-gutter)] focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-accent)_45%,transparent)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
