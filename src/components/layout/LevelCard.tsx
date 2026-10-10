import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useProgress } from '../../store/progress';
import { levelInfo } from '../../lib/xp';
import { ProgressBar, ProgressRing } from '../ui/primitives';
import { Tooltip } from '../ui/Tooltip';
import { fmtNum } from '../shell/turkish';

export default function LevelCard({ collapsed }: { collapsed: boolean }) {
  const xp = useProgress((s) => s.xp);
  const info = levelInfo(xp);
  const label = `Seviye ${info.level}, ${info.title}. ${fmtNum(info.current)} / ${fmtNum(info.needed)} XP`;

  if (collapsed) {
    return (
      <Tooltip side="right" content={label}>
        <Link
          to="/profil"
          aria-label={label}
          className="no-drag mx-auto grid place-items-center rounded-full transition-transform hover:scale-105"
        >
          <ProgressRing value={info.progress} size={44} stroke={3.5} color="var(--c-gold)">
            <span className="text-lg leading-none" aria-hidden>
              {info.emoji}
            </span>
          </ProgressRing>
        </Link>
      </Tooltip>
    );
  }

  return (
    <Link
      to="/profil"
      aria-label={label}
      className={clsx(
        'group block rounded-2xl border border-border bg-surface-2/60 p-3 transition-colors hover:border-border-strong hover:bg-surface-2',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-lg" aria-hidden>
          {info.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-fg">Seviye {info.level}</span>
            <span className="text-[11px] tabular-nums text-muted">
              {fmtNum(info.current)}/{fmtNum(info.needed)}
            </span>
          </div>
          <div className="truncate text-xs text-muted">{info.title}</div>
        </div>
      </div>
      <ProgressBar value={info.progress} height={5} className="mt-2.5" color="linear-gradient(90deg, var(--c-gold), var(--c-accent))" />
    </Link>
  );
}
