// A region ("bölge") postcard: tier title over its landscape. Used as the band header on the
// journey map and as the "current region" card on the dashboard.
import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import { Crown, Lock } from 'lucide-react';
import type { ModuleStatus } from '../../store/progress';
import type { Tier } from '../../types/content';
import TierScenery from './TierScenery';

export function tierVars(color: string): CSSProperties {
  return { ['--tier' as string]: color };
}

export function StatusDots({ statuses, className }: { statuses: ModuleStatus[]; className?: string }) {
  return (
    <span className={clsx('flex items-center gap-1', className)} aria-hidden>
      {statuses.map((st, i) => (
        <span
          key={i}
          className={clsx(
            'h-1.5 rounded-full transition-all',
            st === 'mastered' ? 'w-4 bg-gold' : st === 'locked' ? 'w-1.5 bg-[color-mix(in_oklab,var(--c-fg)_18%,transparent)]' : 'w-2.5',
          )}
          style={st !== 'mastered' && st !== 'locked' ? { background: 'var(--tier)' } : undefined}
        />
      ))}
    </span>
  );
}

export default function RegionBanner({
  tier,
  index,
  statuses,
  locked,
  as: Tag = 'h2',
  id,
  className,
  children,
  aside,
}: {
  tier: Tier;
  index: number; // 1-based region number
  statuses: ModuleStatus[];
  locked: boolean;
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
  children?: ReactNode;
  /** Replaces the default progress summary on the right. */
  aside?: ReactNode;
}) {
  const mastered = statuses.filter((s) => s === 'mastered').length;
  const total = statuses.length;
  const complete = total > 0 && mastered === total;

  return (
    <section
      aria-labelledby={id}
      className={clsx('relative isolate overflow-hidden rounded-3xl border', className)}
      style={{
        ...tierVars(tier.color),
        borderColor: locked ? 'var(--c-border)' : 'color-mix(in oklab, var(--tier) 30%, var(--c-border))',
        background: locked
          ? 'linear-gradient(180deg, var(--c-surface-2), var(--c-surface))'
          : 'linear-gradient(180deg, color-mix(in oklab, var(--tier) 15%, var(--c-surface)), color-mix(in oklab, var(--tier) 4%, var(--c-surface)) 78%)',
      }}
    >
      <TierScenery
        tierId={tier.id}
        color={tier.color}
        muted={locked}
        strength={locked ? 0.55 : 1}
        className="absolute inset-x-0 bottom-0 -z-10 h-[78%] w-full"
      />
      <div className="relative p-5 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={clsx('flex items-center gap-1.5 text-[13px] font-semibold', locked ? 'text-subtle' : 'tier-ink')}>
              <span aria-hidden>{tier.emoji}</span>
              {index}. Bölge
              {locked && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-px text-[11px] font-semibold text-muted">
                  <Lock className="size-3" aria-hidden />
                  Kilitli
                </span>
              )}
            </div>
            <Tag id={id} className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg">
              {tier.title}
            </Tag>
            <p className="mt-1 max-w-[46ch] text-sm leading-5 text-muted">{tier.subtitle}</p>
          </div>
          {aside ?? (
            <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
              {complete ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold">
                  <Crown className="size-3.5" aria-hidden />
                  Bölge tamam
                </span>
              ) : (
                <span className="text-[13px] font-semibold tabular-nums text-fg">
                  {mastered}/{total} <span className="font-medium text-muted">modül</span>
                </span>
              )}
              <StatusDots statuses={statuses} />
            </div>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
