// The full title ladder ("Unvanlar"), derived from titleForLevel so it always matches xp.ts.
import clsx from 'clsx';
import { Check, Lock } from 'lucide-react';
import { levelInfo, titleForLevel, xpForLevel } from '../../../lib/xp';
import { fmtNum } from '../turkish';

export interface LadderRung {
  from: number;
  title: string;
  emoji: string;
}

/** Walks the levels and records each level where the title changes. */
export function titleLadder(maxLevel = 60): LadderRung[] {
  const out: LadderRung[] = [];
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const t = titleForLevel(lvl);
    if (!out.length || out[out.length - 1].title !== t.title) out.push({ from: lvl, title: t.title, emoji: t.emoji });
  }
  return out;
}

const LADDER = titleLadder();

export default function TitleLadder({ xp }: { xp: number }) {
  const { level } = levelInfo(xp);
  const currentIdx = LADDER.reduce((acc, r, i) => (level >= r.from ? i : acc), 0);

  return (
    <section aria-labelledby="ladder-title" className="rounded-3xl border border-border bg-surface p-5 shadow-card">
      <h2 id="ladder-title" className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
        Unvanlar
      </h2>
      <p className="mt-0.5 text-sm text-muted">Seviye atladıkça Ferris sana yeni bir unvan verir.</p>
      <ol className="relative mt-4">
        {LADDER.map((r, i) => {
          const reached = i <= currentIdx;
          const current = i === currentIdx;
          const last = i === LADDER.length - 1;
          return (
            <li key={r.title} className="relative flex gap-3 pb-2.5 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className={clsx('absolute left-[17px] top-9 bottom-0 w-[2px] rounded-full', i < currentIdx ? 'bg-xp/60' : 'bg-border')}
                />
              )}
              <span
                aria-hidden
                className={clsx(
                  'relative z-[1] grid size-9 shrink-0 place-items-center rounded-full border text-[17px]',
                  current
                    ? 'border-xp bg-[color-mix(in_oklab,var(--c-xp)_16%,var(--c-surface))] shadow-[0_0_0_4px_color-mix(in_oklab,var(--c-xp)_14%,transparent)]'
                    : reached
                      ? 'border-transparent bg-surface-2'
                      : 'border-border bg-surface',
                )}
              >
                <span className={clsx(!reached && 'opacity-40 grayscale')}>{r.emoji}</span>
              </span>
              <div
                className={clsx(
                  'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-3 py-1.5',
                  current && 'bg-[color-mix(in_oklab,var(--c-xp)_8%,transparent)]',
                )}
              >
                <div className="min-w-0">
                  <div className={clsx('truncate text-sm font-semibold', reached ? 'text-fg' : 'text-muted')}>{r.title}</div>
                  <div className="text-xs tabular-nums text-subtle">
                    Seviye {r.from}
                    {r.from > 1 ? `, ${fmtNum(xpForLevel(r.from))} XP` : ''}
                  </div>
                </div>
                {current ? (
                  <span className="shrink-0 rounded-full bg-xp px-2 py-0.5 text-[11px] font-bold text-[#1f1600]">Şu an</span>
                ) : reached ? (
                  <Check className="size-4 shrink-0 text-success" aria-label="Ulaşıldı" />
                ) : (
                  <Lock className="size-3.5 shrink-0 text-subtle" aria-label="Henüz ulaşılmadı" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
