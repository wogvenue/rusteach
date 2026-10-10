import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Coffee, Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react';
import { Popover } from '../ui/Popover';
import { ProgressRing } from '../ui/primitives';
import { Button } from '../ui/Button';
import { BREAK_MS, FOCUS_MS, fmtClock, isTimerActive, timeLeft, useFocusTimer } from './focusTimerStore';
import { topButton } from './StreakButton';
import { dayKey } from '../../store/progress';

function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => set((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
}

export default function FocusTimer() {
  const t = useFocusTimer();
  useTick(t.running);
  const left = timeLeft(t);
  const total = t.phase === 'focus' ? FOCUS_MS : BREAK_MS;
  const active = isTimerActive(t);
  const color = t.phase === 'focus' ? 'var(--c-accent)' : 'var(--c-info)';
  const sessions = t.sessionsDay === dayKey() ? t.sessions : 0;

  return (
    <Popover
      label="Odak zamanlayıcısı"
      panelClassName="w-[284px] p-4"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={clsx(topButton, active && 'tabular-nums')}
          aria-label={
            active
              ? `${t.phase === 'focus' ? 'Odak' : 'Mola'}: ${fmtClock(left)} kaldı${t.running ? '' : ', duraklatıldı'}`
              : 'Odak zamanlayıcısı'
          }
          title={active ? undefined : 'Odak zamanlayıcısı'}
        >
          {active ? (
            <>
              <ProgressRing value={1 - left / total} size={18} stroke={2.5} color={color} />
              <span className={clsx(!t.running && 'text-muted')}>{fmtClock(left)}</span>
            </>
          ) : (
            <Timer className="size-[18px] text-muted" aria-hidden />
          )}
        </button>
      )}
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color }}>
          {t.phase === 'focus' ? <Timer className="size-4" aria-hidden /> : <Coffee className="size-4" aria-hidden />}
          {t.phase === 'focus' ? 'Odak zamanı' : 'Mola zamanı'}
        </div>
        <div className="mt-3">
          <ProgressRing value={1 - left / total} size={132} stroke={8} color={color}>
            <span className="text-[28px] font-semibold tracking-tight tabular-nums text-fg" aria-live="off">
              {fmtClock(left)}
            </span>
          </ProgressRing>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {t.running ? (
            <Button size="sm" variant="secondary" icon={<Pause className="size-4" />} onClick={t.pause} data-autofocus>
              Duraklat
            </Button>
          ) : (
            <Button size="sm" icon={<Play className="size-4 fill-current" />} onClick={t.start} data-autofocus>
              {left < total ? 'Sürdür' : t.phase === 'focus' ? 'Odaklanmaya başla' : 'Molayı başlat'}
            </Button>
          )}
          {active && (
            <>
              <button
                type="button"
                onClick={t.skip}
                className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                aria-label={t.phase === 'focus' ? 'Molaya geç' : 'Molayı bitir'}
                title={t.phase === 'focus' ? 'Molaya geç' : 'Molayı bitir'}
              >
                <SkipForward className="size-4" />
              </button>
              <button
                type="button"
                onClick={t.reset}
                className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                aria-label="Sıfırla"
                title="Sıfırla"
              >
                <RotateCcw className="size-4" />
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-[13px] leading-5 text-muted">
          25 dakika odaklan, 5 dakika dinlen. Molada ekrandan uzaklaşmak, öğrendiklerinin yerleşmesine yardım eder.
        </p>
        {sessions > 0 && (
          <p className="mt-2 text-[13px] font-semibold text-fg">
            Bugün {sessions} odak turu tamamladın {'🍅'.repeat(Math.min(sessions, 4))}
          </p>
        )}
      </div>
    </Popover>
  );
}
