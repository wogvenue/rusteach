import clsx from 'clsx';
import { Flame, Snowflake } from 'lucide-react';
import { addDays, dayKey, useProgress } from '../../store/progress';
import { Popover } from '../ui/Popover';
import { effectiveStreak, isActiveDay, studiedToday } from '../shell/stats';
import { parseDayKey, WEEKDAYS_SHORT, weekdayIndex } from '../shell/turkish';
import { useNow } from '../shell/useNow';

export const topButton =
  'no-drag inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-fg transition-colors hover:bg-surface-2 aria-expanded:bg-surface-2';

export default function StreakButton() {
  const now = useNow();
  const today = dayKey(now);
  const s = useProgress();
  const streak = effectiveStreak(s, today);
  const doneToday = studiedToday(s, today);

  return (
    <Popover
      label="Seri"
      panelClassName="w-[300px] p-4"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={topButton}
          aria-label={`Seri: ${streak} gün${doneToday ? ', bugün çalıştın' : ''}`}
        >
          <Flame
            className={clsx(
              'size-[18px]',
              doneToday ? 'animate-flicker fill-current text-streak' : streak > 0 ? 'text-streak' : 'text-subtle',
            )}
            aria-hidden
          />
          <span className={clsx('tabular-nums', streak === 0 && 'text-muted')}>{streak}</span>
        </button>
      )}
    >
      <StreakPanel today={today} />
    </Popover>
  );
}

function StreakPanel({ today }: { today: string }) {
  const s = useProgress();
  const streak = effectiveStreak(s, today);
  const doneToday = studiedToday(s, today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'grid size-12 place-items-center rounded-2xl',
            streak > 0 ? 'bg-[color-mix(in_oklab,var(--c-streak)_16%,transparent)] text-streak' : 'bg-surface-2 text-subtle',
          )}
        >
          <Flame className={clsx('size-7', streak > 0 && 'fill-current')} aria-hidden />
        </span>
        <div>
          <div className="text-lg font-semibold tracking-tight">{streak > 0 ? `${streak} günlük seri` : 'Seri henüz yok'}</div>
          <div className="text-[13px] text-muted">En uzun serin: {s.streak.best} gün</div>
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Son 7 gün">
        {days.map((d) => {
          const active = isActiveDay(s.activity[d]);
          const frozen = s.streak.frozenDays.includes(d);
          const isToday = d === today;
          const label = WEEKDAYS_SHORT[weekdayIndex(parseDayKey(d))];
          return (
            <li key={d} className="flex flex-col items-center gap-1.5">
              <span className={clsx('text-[11px] font-medium', isToday ? 'text-fg' : 'text-subtle')}>{label}</span>
              <span
                className={clsx(
                  'grid size-8 place-items-center rounded-full',
                  active && 'bg-streak text-accent-fg',
                  !active && frozen && 'bg-info-soft text-info',
                  !active && !frozen && isToday && 'border-2 border-dashed border-streak/60',
                  !active && !frozen && !isToday && 'border border-border-strong',
                )}
                title={active ? 'Çalıştın' : frozen ? 'Seri dondurma kullanıldı' : isToday ? 'Bugün' : 'Çalışılmadı'}
              >
                {active ? (
                  <Flame className="size-4 fill-current" aria-label="Çalıştın" />
                ) : frozen ? (
                  <Snowflake className="size-4" aria-label="Donduruldu" />
                ) : (
                  <span className="sr-only">{isToday ? 'Bugün henüz çalışılmadı' : 'Çalışılmadı'}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p className={clsx('mt-4 rounded-xl px-3 py-2 text-[13px] leading-5', doneToday ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted')}>
        {doneToday
          ? 'Bugünkü çalışmanı yaptın, serin güvende.'
          : streak > 0
            ? `Bugün bir ders ya da birkaç tekrar yaparak serini ${streak + 1} güne çıkar.`
            : 'Bugün bir şey öğren, yeni serin başlasın.'}
      </p>

      <div className="mt-3 flex items-start gap-3 border-t border-border pt-3">
        <div className="flex shrink-0 gap-1 pt-0.5" aria-hidden>
          {[0, 1].map((i) => (
            <span
              key={i}
              className={clsx(
                'grid size-7 place-items-center rounded-lg',
                i < s.streak.freezes ? 'bg-info-soft text-info' : 'bg-surface-2 text-subtle',
              )}
            >
              <Snowflake className="size-4" />
            </span>
          ))}
        </div>
        <div className="text-[13px] leading-5">
          <div className="font-semibold">Seri dondurma: {s.streak.freezes}/2</div>
          <div className="text-muted">Her 7 günlük seride bir tane kazanırsın. Bir gün kaçırırsan otomatik kullanılır.</div>
        </div>
      </div>
    </div>
  );
}
