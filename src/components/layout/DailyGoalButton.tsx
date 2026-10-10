import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { todayActivity, useProgress, XP } from '../../store/progress';
import { Popover } from '../ui/Popover';
import { ProgressRing } from '../ui/primitives';
import { fmtDuration, fmtNum, fmtPct } from '../shell/turkish';
import { useNow } from '../shell/useNow';
import { topButton } from './StreakButton';

export default function DailyGoalButton() {
  useNow(); // re-evaluate "today" after midnight
  const s = useProgress();
  const day = todayActivity(s);
  const goal = s.settings.dailyGoalXp;
  const value = Math.min(1, day.xp / goal);
  const done = day.xp >= goal;

  return (
    <Popover
      label="Günlük hedef"
      panelClassName="w-[280px] p-4"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={topButton}
          aria-label={`Günlük hedef: ${day.xp} / ${goal} XP`}
        >
          <ProgressRing value={value} size={24} stroke={3.5} color={done ? 'var(--c-success)' : 'var(--c-accent)'}>
            {done && <Check className="size-3 text-success" strokeWidth={3} aria-hidden />}
          </ProgressRing>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-4">
            <ProgressRing value={value} size={72} stroke={7} color={done ? 'var(--c-success)' : 'var(--c-accent)'}>
              <span className="text-[15px] font-bold">{fmtPct(value)}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight">Günlük hedef</div>
              <div className="text-[13px] tabular-nums text-muted">
                {fmtNum(day.xp)} / {fmtNum(goal)} XP
              </div>
              <div className={done ? 'mt-1 text-[13px] font-medium text-success' : 'mt-1 text-[13px] text-muted'}>
                {done ? `Tamamlandı, +${XP.dailyGoalBonus} XP bonus kazandın.` : `${fmtNum(goal - day.xp)} XP kaldı.`}
              </div>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            {(
              [
                ['Ders', day.lessons],
                ['Soru', day.checks],
                ['Alıştırma', day.exercises],
                ['Tekrar', day.reviews],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-base font-semibold tabular-nums">{fmtNum(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-muted">Bugünkü çalışma: {fmtDuration(day.seconds)}</span>
            <Link to="/ayarlar#ogrenme" onClick={close} className="font-semibold text-accent hover:underline">
              Hedefi değiştir
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}
