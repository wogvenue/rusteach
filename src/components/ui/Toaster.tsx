// Animated toast stack (top-right, below the title bar). Achievement and level toasts get a
// celebratory treatment; XP toasts are small pills.
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { CircleAlert, CircleCheck, Info, Sparkles, X, Zap } from 'lucide-react';
import { useUi, type Toast } from '../../store/ui';

export default function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  const ordered = [...toasts].reverse(); // newest on top
  return (
    <div
      className="no-drag pointer-events-none fixed right-4 top-[60px] z-[100] flex w-[min(380px,calc(100vw-32px))] flex-col items-end gap-2"
      role="region"
      aria-label="Bildirimler"
    >
      <AnimatePresence initial={false}>
        {ordered.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 48, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 32, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto"
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <ToastView t={t} onClose={() => dismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastView({ t, onClose }: { t: Toast; onClose: () => void }) {
  if (t.kind === 'xp') return <XpPill t={t} />;
  if (t.kind === 'achievement') return <AchievementToast t={t} onClose={onClose} />;
  if (t.kind === 'level') return <LevelToast t={t} onClose={onClose} />;
  return <PlainToast t={t} onClose={onClose} />;
}

function XpPill({ t }: { t: Toast }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border-strong bg-elevated py-1.5 pl-2 pr-3.5 shadow-pop">
      <span className="grid size-6 place-items-center rounded-full bg-gold-soft text-xp">
        <Zap className="size-3.5 fill-current" aria-hidden />
      </span>
      <span className="text-sm font-bold tabular-nums text-xp">{t.title}</span>
      {t.description && <span className="max-w-52 truncate text-[13px] text-muted">{t.description}</span>}
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Bildirimi kapat"
      className="grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <X className="size-4" />
    </button>
  );
}

function PlainToast({ t, onClose }: { t: Toast; onClose: () => void }) {
  const tone = {
    info: { cls: 'text-info bg-info-soft', icon: <Info className="size-[18px]" aria-hidden /> },
    success: { cls: 'text-success bg-success-soft', icon: <CircleCheck className="size-[18px]" aria-hidden /> },
    error: { cls: 'text-danger bg-danger-soft', icon: <CircleAlert className="size-[18px]" aria-hidden /> },
  }[t.kind as 'info' | 'success' | 'error'] ?? { cls: 'text-info bg-info-soft', icon: <Info className="size-[18px]" /> };
  return (
    <div className="flex w-full items-start gap-3 rounded-2xl border border-border-strong bg-elevated p-3 pr-2 shadow-pop">
      <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl text-lg', tone.cls)}>{t.icon ?? tone.icon}</span>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="text-sm font-semibold leading-5 text-fg">{t.title}</div>
        {t.description && <div className="mt-0.5 text-[13px] leading-5 text-muted">{t.description}</div>}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

function AchievementToast({ t, onClose }: { t: Toast; onClose: () => void }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--c-gold),color-mix(in_oklab,var(--c-gold)_20%,transparent)_45%,var(--c-accent))] p-px shadow-pop">
      <div className="relative flex items-center gap-3.5 overflow-hidden rounded-[15px] bg-elevated p-3.5 pr-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--c-gold)_22%,transparent),transparent)]"
        />
        <motion.span
          className="relative grid size-12 shrink-0 place-items-center rounded-full bg-gold-soft text-[26px] shadow-[0_0_0_1px_color-mix(in_oklab,var(--c-gold)_45%,transparent),0_0_24px_-4px_var(--c-gold)]"
          initial={{ rotate: -25, scale: 0.4 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.08 }}
          aria-hidden
        >
          {t.icon ?? '🏆'}
        </motion.span>
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs font-semibold text-gold">
            <Sparkles className="size-3.5" aria-hidden />
            Başarım açıldı
          </div>
          <div className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">{t.title}</div>
          {t.description && <div className="mt-0.5 text-[13px] leading-5 text-muted">{t.description}</div>}
        </div>
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function LevelToast({ t, onClose }: { t: Toast; onClose: () => void }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--c-accent)_45%,transparent)] bg-elevated shadow-pop">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,color-mix(in_oklab,var(--c-accent)_30%,transparent),transparent_60%)]" />
      <div className="relative flex items-center gap-3.5 p-3.5 pr-2">
        <motion.span
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-[26px] text-accent-fg shadow-[0_8px_24px_-8px_var(--c-accent)]"
          initial={{ y: 10, scale: 0.6 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.06 }}
          aria-hidden
        >
          {t.icon ?? '⬆️'}
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-accent">Seviye atladın!</div>
          <div className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">{t.title}</div>
          {t.description && <div className="mt-0.5 text-[13px] leading-5 text-muted">{t.description}</div>}
        </div>
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}
