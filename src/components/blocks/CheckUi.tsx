// Small UI pieces shared by check blocks: confidence picker, feedback panel, XP pill.
import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CircleCheck, CircleX, Eye, RotateCcw, Undo2 } from 'lucide-react';
import type { Confidence } from '../../store/progress';
import type { BlockMode } from './types';
import Html from './Html';
import { useBlockHotkeys } from './hotkeys';

const LEVELS: { value: Confidence; label: string; hint: string }[] = [
  { value: 1, label: 'Tahmin', hint: 'Emin değilim, tahmin ettim' },
  { value: 2, label: 'Biraz eminim', hint: 'Doğru olduğunu düşünüyorum' },
  { value: 3, label: 'Çok eminim', hint: 'Bundan eminim' },
];

function Bars({ n, active }: { n: number; active?: boolean }) {
  return (
    <span className="inline-flex h-3.5 items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={clsx('w-[4px] rounded-full transition-colors', i <= n ? (active ? 'bg-accent' : 'bg-fg/70') : 'bg-border-strong')}
          style={{ height: 5 + i * 3 }}
        />
      ))}
    </span>
  );
}

export function ConfidencePicker({
  onPick,
  onBack,
  autoFocus = true,
}: {
  onPick: (c: Confidence) => void;
  onBack?: () => void;
  autoFocus?: boolean;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // 1-3 pick a level in every check block (the kbd hints promise it), not only in those that wire it.
  useBlockHotkeys(
    boxRef,
    () => true,
    (e) => {
      if (!/^[1-3]$/.test(e.key)) return false;
      onPick(Number(e.key) as Confidence);
      return true;
    },
  );
  useEffect(() => {
    if (autoFocus) firstRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <motion.div
      ref={boxRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="mt-4 rounded-2xl border border-accent/25 bg-accent/5 p-4"
      role="group"
      aria-label="Ne kadar eminsin?"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-fg">Ne kadar eminsin?</span>
        <span className="text-xs text-muted">Cevabı görmeden önce kendini yokla.</span>
        <span className="flex-1" />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Undo2 className="size-3.5" /> Cevabı değiştir
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((l, i) => (
          <motion.button
            key={l.value}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(l.value)}
            title={l.hint}
            className="group flex items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Bars n={l.value} />
            <span>{l.label}</span>
            <span className="kbd-hint hidden text-muted sm:inline">{l.value}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

export function XpPill({ xp }: { xp: number }) {
  if (xp <= 0) return null;
  return (
    <motion.span
      initial={{ opacity: 0, y: 6, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 }}
      className="inline-flex items-center rounded-full bg-xp/15 px-2 py-0.5 text-xs font-bold text-xp"
    >
      +{xp} XP
    </motion.span>
  );
}

const RIGHT = ['Doğru!', 'Harika!', 'Aynen öyle!', 'Tam isabet!', 'Çok iyi!'];
const WRONG = ['Tam değil.', 'Bu sefer olmadı.', 'Öyle değil.'];

function pick(list: string[], seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

export function FeedbackPanel({
  correct,
  revealed,
  explanation,
  xp = 0,
  confidence,
  mode,
  seed,
  children,
  onRetry,
  onReveal,
  pendingText,
}: {
  correct: boolean;
  revealed: boolean;
  explanation?: string;
  xp?: number;
  confidence?: Confidence;
  mode: BlockMode;
  seed: string;
  children?: ReactNode;
  onRetry?: () => void;
  onReveal?: () => void;
  pendingText?: string;
}) {
  const pending = !correct && !revealed;
  let note: string | null = null;
  if (mode !== 'review') {
    if (correct && confidence === 1)
      note = 'Tahminle buldun; bu soruyu tekrar destene ekledik, yakında yeniden sorulacak.';
    else if (!correct && confidence === 3)
      note = 'Emin olduğun bir yanılgı, bu tür hatalar düzeltildiğinde en kalıcı öğrenme gerçekleşir. Açıklamayı dikkatle oku.';
    else if (!correct && revealed) note = 'Bu soru tekrar destene eklendi; birkaç gün içinde yeniden karşına çıkacak.';
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={clsx(
        'mt-4 rounded-2xl border p-4',
        correct ? 'border-success/30 bg-success/6' : 'border-border bg-surface-2/60',
      )}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        <motion.span
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          className={correct ? 'text-success' : 'text-danger'}
        >
          {correct ? <CircleCheck className="size-5" /> : <CircleX className="size-5" />}
        </motion.span>
        <span className={clsx('font-semibold', correct ? 'text-success' : 'text-danger')}>
          {correct ? pick(RIGHT, seed) : pick(WRONG, seed)}
        </span>
        <span className="flex-1" />
        <XpPill xp={xp} />
      </div>
      {pending && (
        <div className="mt-2">
          <p className="text-sm text-muted">
            {pendingText ?? 'Bir kez daha düşünmek ister misin? Doğru cevabı görmeden önce yeniden denemek öğrenmeyi güçlendirir.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <RotateCcw className="size-4" /> Tekrar dene
              </button>
            )}
            {onReveal && (
              <button
                type="button"
                onClick={onReveal}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Eye className="size-4" /> Cevabı göster
              </button>
            )}
          </div>
        </div>
      )}
      {children}
      {revealed && explanation && (
        mode === 'boss' ? (
          <details className="group mt-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted hover:text-fg">Açıklamayı göster</summary>
            <Html html={explanation} size="sm" className="mt-2" />
          </details>
        ) : (
          <Html html={explanation} size="sm" className="mt-2.5" />
        )
      )}
      {revealed && note && <p className="mt-3 border-t border-border pt-2.5 text-xs leading-relaxed text-muted">{note}</p>}
    </motion.div>
  );
}
