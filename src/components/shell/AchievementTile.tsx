import clsx from 'clsx';
import { Lock } from 'lucide-react';
import type { AchievementDef } from '../../lib/achievements';
import type { ProgressData } from '../../store/progress';
import { fmtDate } from './turkish';

/** One achievement: unlocked (gold), locked with progress, or secret. */
export default function AchievementTile({
  def,
  unlockedAt,
  state,
  size = 'md',
  className,
}: {
  def: AchievementDef;
  unlockedAt?: string;
  state: ProgressData;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const unlocked = !!unlockedAt;
  const hidden = !unlocked && def.secret;
  const prog = !unlocked && !hidden && def.progress ? def.progress(state) : null;
  const pct = prog ? Math.min(1, prog.value / Math.max(1, prog.target)) : 0;

  return (
    <div
      className={clsx(
        'relative flex gap-3 overflow-hidden rounded-2xl border p-3.5 transition-colors',
        unlocked
          ? 'border-[color-mix(in_oklab,var(--c-gold)_32%,var(--c-border))] bg-[color-mix(in_oklab,var(--c-gold)_6%,var(--c-surface))]'
          : 'border-border bg-surface',
        className,
      )}
    >
      <span
        className={clsx(
          'relative grid shrink-0 place-items-center rounded-xl',
          size === 'sm' ? 'size-10 text-xl' : 'size-12 text-[26px]',
          unlocked ? 'bg-gold-soft' : 'bg-surface-2',
        )}
        aria-hidden
      >
        {hidden ? (
          <span className="text-lg font-bold text-subtle">?</span>
        ) : (
          <span className={clsx(!unlocked && 'opacity-45 grayscale')}>{def.icon}</span>
        )}
        {!unlocked && !hidden && (
          <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border border-border bg-surface text-subtle">
            <Lock className="size-3" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className={clsx('truncate text-sm font-semibold', unlocked ? 'text-fg' : 'text-muted')}>
          {hidden ? 'Gizli başarım' : def.title}
        </div>
        <p className="mt-0.5 text-[13px] leading-5 text-muted">
          {hidden ? 'Rusteach’i keşfettikçe kendiliğinden açılır.' : def.description}
        </p>
        {unlocked && <p className="mt-1.5 text-xs font-medium text-gold">{fmtDate(unlockedAt!)} tarihinde açıldı</p>}
        {prog && prog.target > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c-fg)_9%,transparent)]">
              <div className="h-full rounded-full bg-subtle" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-subtle">
              {prog.value}/{prog.target}
            </span>
          </div>
        )}
      </div>
      <span className="sr-only">{unlocked ? 'Açıldı.' : 'Henüz açılmadı.'}</span>
    </div>
  );
}
