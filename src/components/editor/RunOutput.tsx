// Terminal-style run result: status line (success / compile error / panic / timeout + duration +
// backend), stdout, and highlighted stderr with clickable error-code chips.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { Check, CircleAlert, Copy, Flame, Hourglass, Loader2, Terminal, TriangleAlert, WifiOff, X } from 'lucide-react';
import type { RunMode, RunResult } from '../../types/bridge';
import CompilerText from './CompilerText';
import { copyText } from './util';
import { formatDuration, likelyOnline, useElapsed } from './useRunner';

export type RunExpectation = 'compile_fail' | 'should_panic';

interface StatusInfo {
  tone: 'success' | 'danger' | 'warning' | 'info';
  label: string;
  icon: typeof Check;
}

export function statusOf(r: RunResult, mode: RunMode | null, expect?: RunExpectation): StatusInfo {
  const panicked = /panicked/.test(r.stderr) || /panicked/.test(r.stdout);
  if (r.infraError) return { tone: 'warning', label: 'Çalıştırılamadı', icon: WifiOff };
  if (r.timedOut) return { tone: 'warning', label: 'Zaman aşımı', icon: Hourglass };
  if (r.compileError) {
    return expect === 'compile_fail'
      ? { tone: 'info', label: 'Derlenmedi (beklenen sonuç)', icon: CircleAlert }
      : { tone: 'danger', label: 'Derleme hatası', icon: CircleAlert };
  }
  if (!r.ok && mode === 'test') return { tone: 'danger', label: 'Bazı testler geçmedi', icon: TriangleAlert };
  if (!r.ok && panicked) {
    return expect === 'should_panic'
      ? { tone: 'info', label: 'Panik! (beklenen sonuç)', icon: Flame }
      : { tone: 'danger', label: 'Panik!', icon: Flame };
  }
  if (!r.ok) return { tone: 'danger', label: 'Program hata koduyla bitti', icon: TriangleAlert };
  if (mode === 'compile') return { tone: 'success', label: 'Derleme başarılı', icon: Check };
  if (mode === 'test') return { tone: 'success', label: 'Tüm testler geçti', icon: Check };
  return { tone: 'success', label: 'Başarılı', icon: Check };
}

const toneClass = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
} as const;

const runningLabels: Record<RunMode, string> = {
  run: 'Derleniyor ve çalıştırılıyor…',
  test: 'Testler çalışıyor…',
  compile: 'Derleniyor…',
};

export interface RunOutputProps {
  result: RunResult | null;
  running?: boolean;
  mode?: RunMode | null;
  startedAt?: number | null;
  expect?: RunExpectation;
  /** Expected compiler error code for compile_fail examples. */
  expectedError?: string;
  onClose?: () => void;
  className?: string;
  maxHeight?: number | string;
  /** Hide the stdout section (e.g. when a parent shows a diff instead). */
  hideStdout?: boolean;
}

export default function RunOutput({
  result,
  running = false,
  mode = 'run',
  startedAt = null,
  expect,
  expectedError,
  onClose,
  className,
  maxHeight = 340,
  hideStdout,
}: RunOutputProps) {
  const elapsed = useElapsed(startedAt, running);
  const [copied, setCopied] = useState(false);
  if (!running && !result) return null;

  const status = result && !running ? statusOf(result, mode, expect) : null;
  const stdout = result?.stdout ?? '';
  const stderr = result?.stderr ?? '';
  const hasExpectedError = !!expectedError && stderr.includes(`[${expectedError}]`);
  const slowHint = running && elapsed > 2500 && likelyOnline();

  const copyAll = async () => {
    const ok = await copyText([stdout, stderr].filter(Boolean).join('\n'));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <div className={clsx('run-output', className)} aria-live="polite">
      <div className="flex min-h-10 items-center gap-2.5 px-4 py-2 text-[0.8rem]" style={{ fontFamily: 'var(--font-sans)' }}>
        {running ? (
          <>
            <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
            <span className="font-semibold text-fg">{runningLabels[mode ?? 'run']}</span>
            <span className="font-mono text-xs tabular-nums text-subtle">{formatDuration(elapsed)}</span>
          </>
        ) : status && result ? (
          <>
            <status.icon className={clsx('size-4', toneClass[status.tone])} aria-hidden />
            <span className={clsx('font-semibold', toneClass[status.tone])}>{status.label}</span>
            {result.durationMs > 0 && (
              <span className="font-mono text-xs tabular-nums text-subtle">{formatDuration(result.durationMs)}</span>
            )}
            <span
              className="rounded-md border border-border px-1.5 py-px text-[0.68rem] font-semibold text-muted"
              title={result.backend === 'local' ? 'Bilgisayarındaki Rust ile çalıştı' : 'Rust Playground üzerinde çalıştı'}
            >
              {result.backend === 'local' ? 'Yerel' : 'Çevrimiçi'}
            </span>
            {hasExpectedError && (
              <span className="rounded-md bg-info-soft px-1.5 py-px text-[0.68rem] font-semibold text-info">
                Beklenen hata: {expectedError}
              </span>
            )}
          </>
        ) : null}
        <span className="flex-1" />
        {!running && result && (stdout || stderr) && (
          <button
            type="button"
            onClick={copyAll}
            className="grid size-7 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Çıktıyı kopyala"
            title="Çıktıyı kopyala"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        )}
        {onClose && !running && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Çıktıyı kapat"
            title="Kapat"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {running && <div className="run-progress" />}
      <AnimatePresence initial={false}>
        {slowHint && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-4 pb-2 pt-2 text-xs text-muted"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Kod çevrimiçi Rust Playground'da derleniyor; ilk çalıştırma birkaç saniye sürebilir.
          </motion.p>
        )}
      </AnimatePresence>
      {!running && result && (
        <div className="overflow-auto border-t border-[var(--code-border)] px-4 py-3" style={{ maxHeight }}>
          {result.infraError ? (
            <p className="text-sm leading-relaxed text-muted" style={{ fontFamily: 'var(--font-sans)' }}>
              {result.infraError}
            </p>
          ) : (
            <>
              {!hideStdout && stdout && <StdoutText text={stdout} />}
              {!hideStdout && !stdout && !stderr && (
                <p className="flex items-center gap-2 text-xs italic text-subtle">
                  <Terminal className="size-3.5" />
                  {mode === 'compile'
                    ? 'Derleyici hiçbir hata ya da uyarı vermedi.'
                    : 'Program ekrana bir şey yazdırmadı.'}
                </p>
              )}
              {stderr && (
                <div className={clsx(!hideStdout && stdout && 'mt-3 border-t border-dashed border-[var(--code-border)] pt-3')}>
                  <CompilerText text={stderr} />
                </div>
              )}
              {result.timedOut && (
                <p className="mt-2 text-xs text-warning" style={{ fontFamily: 'var(--font-sans)' }}>
                  Program zaman aşımına uğradı, sonsuz bir döngü olabilir mi?
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StdoutText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  return (
    <pre>
      {lines.map((l, i) => {
        const m = /^(test \S+ \.\.\. )(ok|FAILED|ignored)$/.exec(l);
        if (m)
          return (
            <span className="out-line" key={i}>
              {m[1]}
              <span className={m[2] === 'ok' ? 'out-help' : m[2] === 'FAILED' ? 'out-error' : 'out-dim'} style={{ fontWeight: 700 }}>
                {m[2]}
              </span>
            </span>
          );
        return (
          <span className="out-line" key={i}>
            {l}
          </span>
        );
      })}
    </pre>
  );
}
