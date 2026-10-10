// 16-week activity heatmap (Monday-first columns). Intensity is relative to the daily goal.
import { useMemo, useState } from 'react';
import { addDays, dayKey, type DayActivity } from '../../store/progress';
import { FloatingCard, tooltipBubble } from '../ui/Tooltip';
import { isActiveDay } from './stats';
import { fmtDayLong, fmtDuration, MONTHS_SHORT, parseDayKey, weekdayIndex } from './turkish';

const LEVEL_BG = [
  'color-mix(in oklab, var(--c-fg) 7%, transparent)',
  'color-mix(in oklab, var(--c-accent) 30%, transparent)',
  'color-mix(in oklab, var(--c-accent) 52%, transparent)',
  'color-mix(in oklab, var(--c-accent) 76%, transparent)',
  'var(--c-accent)',
];

function level(a: DayActivity | undefined, goal: number): number {
  if (!isActiveDay(a)) return 0;
  const r = (a?.xp ?? 0) / Math.max(1, goal);
  if (a?.goalBonus || r >= 1) return 4;
  if (r >= 0.67) return 3;
  if (r >= 0.34) return 2;
  return 1;
}

export default function Heatmap({
  activity,
  goal,
  weeks = 16,
  now = new Date(),
}: {
  activity: Record<string, DayActivity>;
  goal: number;
  weeks?: number;
  now?: Date;
}) {
  const today = dayKey(now);
  const [hover, setHover] = useState<{ key: string; rect: DOMRect } | null>(null);

  const { columns, months, activeDays } = useMemo(() => {
    const start = addDays(today, -weekdayIndex(now) - (weeks - 1) * 7);
    const cols: string[][] = [];
    for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
    const labels: { col: number; text: string }[] = [];
    let prevMonth = -1;
    cols.forEach((c, i) => {
      const m = parseDayKey(c[0]).getMonth();
      if (m !== prevMonth) {
        if (i < weeks - 1 || labels.length === 0) labels.push({ col: i, text: MONTHS_SHORT[m] });
        prevMonth = m;
      }
    });
    const act = cols.flat().filter((k) => k <= today && isActiveDay(activity[k])).length;
    return { columns: cols, months: labels, activeDays: act };
  }, [today, weeks, activity, now]);

  const hovered = hover ? activity[hover.key] : undefined;

  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `28px repeat(${weeks}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Son ${weeks} haftada ${activeDays} gün çalıştın.`}
      >
        {/* month labels */}
        <span />
        {columns.map((_, i) => {
          const m = months.find((x) => x.col === i);
          return (
            <span key={`m${i}`} className="h-4 overflow-visible whitespace-nowrap text-[11px] font-medium text-subtle">
              {m?.text ?? ''}
            </span>
          );
        })}
        {/* rows */}
        {Array.from({ length: 7 }, (_, d) => (
          <Row key={d} d={d} columns={columns} today={today} activity={activity} goal={goal} onHover={setHover} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted">
        <span>
          Son {weeks} haftada <strong className="font-semibold text-fg">{activeDays} gün</strong> çalıştın.
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          Az
          {LEVEL_BG.map((bg, i) => (
            <span key={i} className="size-3 rounded-[3px]" style={{ background: bg }} />
          ))}
          Çok
        </span>
      </div>

      <FloatingCard anchor={hover?.rect ?? null} side="top" className={tooltipBubble}>
        {hover && (
          <div className="whitespace-nowrap">
            <div className="font-semibold">{fmtDayLong(parseDayKey(hover.key))}</div>
            {isActiveDay(hovered) ? (
              <div className="mt-0.5 text-muted">
                {hovered!.xp} XP
                {hovered!.lessons > 0 && `, ${hovered!.lessons} ders`}
                {hovered!.reviews > 0 && `, ${hovered!.reviews} tekrar`}
                {hovered!.seconds >= 60 && `, ${fmtDuration(hovered!.seconds)}`}
              </div>
            ) : (
              <div className="mt-0.5 text-muted">Çalışma yok</div>
            )}
          </div>
        )}
      </FloatingCard>
    </div>
  );
}

const DAY_LABELS: Record<number, string> = { 0: 'Pzt', 2: 'Çar', 4: 'Cum' };

function Row({
  d,
  columns,
  today,
  activity,
  goal,
  onHover,
}: {
  d: number;
  columns: string[][];
  today: string;
  activity: Record<string, DayActivity>;
  goal: number;
  onHover: (h: { key: string; rect: DOMRect } | null) => void;
}) {
  return (
    <>
      <span className="flex items-center text-[11px] font-medium text-subtle">{DAY_LABELS[d] ?? ''}</span>
      {columns.map((col) => {
        const key = col[d];
        const future = key > today;
        const lvl = future ? -1 : level(activity[key], goal);
        return (
          <span
            key={key}
            className="aspect-square max-h-[18px] w-full rounded-[4px] transition-transform hover:scale-125"
            style={{
              background: lvl < 0 ? 'transparent' : LEVEL_BG[lvl],
              boxShadow: key === today ? 'inset 0 0 0 1.5px var(--c-fg)' : undefined,
            }}
            onPointerEnter={(e) => !future && onHover({ key, rect: e.currentTarget.getBoundingClientRect() })}
            onPointerLeave={() => onHover(null)}
          />
        );
      })}
    </>
  );
}
