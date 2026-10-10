// Study calendar for the last 26 weeks: one square per day, coloured by the XP earned relative to the
// daily goal. Keyboard: the grid is one tab stop; arrow keys move between days and show the details.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { CalendarCheck2, Flame, Sparkles, Trophy } from 'lucide-react';
import { formatDuration, formatNumber, longDate, shortDate, WEEKDAYS_SHORT, type HeatDay, type HeatmapData } from '../../lib/stats';
import { FloatingCard } from '../ui/Tooltip';
import { ChartCard, DataTable } from './chartKit';

const LEVEL_BG = ['var(--lx-heat-0)', 'var(--lx-heat-1)', 'var(--lx-heat-2)', 'var(--lx-heat-3)', 'var(--lx-heat-4)'];

function dayDetails(day: HeatDay): string[] {
  const a = day.activity;
  const parts: string[] = [];
  if (a.lessons) parts.push(`${a.lessons} ders`);
  if (a.reviews) parts.push(`${a.reviews} tekrar`);
  if (a.checks) parts.push(`${a.checks} soru`);
  if (a.exercises) parts.push(`${a.exercises} alıştırma`);
  return parts;
}

function cellLabel(day: HeatDay, goal: number): string {
  if (day.future) return `${longDate(day.key)}: henüz gelmedi`;
  const a = day.activity;
  if (!a.xp && !a.seconds) return `${longDate(day.key)}: çalışma yok`;
  const details = dayDetails(day);
  return `${longDate(day.key)}: ${formatNumber(a.xp)} XP${a.xp >= goal ? ', hedefe ulaşıldı' : ''}${details.length ? `, ${details.join(', ')}` : ''}`;
}

function DayCard({ day, goal }: { day: HeatDay; goal: number }) {
  const a = day.activity;
  const details = dayDetails(day);
  return (
    <div className="min-w-44 rounded-xl border border-border-strong bg-elevated px-3 py-2.5 text-xs shadow-pop">
      <div className="font-semibold text-fg">{longDate(day.key)}</div>
      {day.future ? (
        <div className="mt-1 text-muted">Henüz gelmedi</div>
      ) : a.xp || a.seconds ? (
        <>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-base font-semibold text-fg lx-tabular">{formatNumber(a.xp)} XP</span>
            {a.xp >= goal && <span className="font-medium text-success">Hedefe ulaştın</span>}
          </div>
          {details.length > 0 && <div className="mt-1 text-muted">{details.join(', ')}</div>}
          {a.seconds > 0 && <div className="mt-0.5 text-muted">{formatDuration(a.seconds)} çalışma</div>}
        </>
      ) : (
        <div className="mt-1 text-muted">Çalışma yok</div>
      )}
    </div>
  );
}

export default function ActivityHeatmap({ data, goal, streak }: { data: HeatmapData; goal: number; streak: { current: number; best: number } }) {
  const weeks = data.weeks;
  const todayPos = useMemo(() => {
    for (let w = weeks.length - 1; w >= 0; w--) {
      const d = weeks[w].findIndex((x) => x.today);
      if (d >= 0) return { w, d };
    }
    return { w: weeks.length - 1, d: 0 };
  }, [weeks]);
  const [pos, setPos] = useState(todayPos);
  const [shown, setShown] = useState<{ day: HeatDay; rect: DOMRect } | null>(null);
  const cells = useRef(new Map<string, HTMLDivElement>());

  const show = (day: HeatDay, el: HTMLElement) => setShown({ day, rect: el.getBoundingClientRect() });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let { w, d } = pos;
    if (e.key === 'ArrowRight') w++;
    else if (e.key === 'ArrowLeft') w--;
    else if (e.key === 'ArrowDown') d++;
    else if (e.key === 'ArrowUp') d--;
    else if (e.key === 'Home') w = 0;
    else if (e.key === 'End') ({ w, d } = todayPos);
    else if (e.key === 'Escape') {
      setShown(null);
      return;
    } else return;
    e.preventDefault();
    w = Math.max(0, Math.min(weeks.length - 1, w));
    d = Math.max(0, Math.min(6, d));
    if (weeks[w][d].future) return;
    setPos({ w, d });
    const el = cells.current.get(`${w}-${d}`);
    el?.focus();
  };

  const legendRanges = [
    { level: 0, text: '0' },
    { level: 1, text: `1–${Math.max(1, Math.ceil(goal / 2) - 1)}` },
    { level: 2, text: `${Math.ceil(goal / 2)}–${goal - 1}` },
    { level: 3, text: `${goal}–${goal * 2 - 1}` },
    { level: 4, text: `${goal * 2}+` },
  ];

  const activeRows = useMemo(
    () =>
      weeks
        .flat()
        .filter((d) => !d.future && (d.activity.xp > 0 || d.activity.seconds > 0))
        .reverse()
        .map((d) => ({
          date: shortDate(d.key),
          xp: formatNumber(d.activity.xp),
          lessons: d.activity.lessons,
          reviews: d.activity.reviews,
          checks: d.activity.checks,
          time: d.activity.seconds ? formatDuration(d.activity.seconds) : '—',
        })),
    [weeks],
  );

  const stats = [
    { icon: CalendarCheck2, label: 'Aktif gün', value: formatNumber(data.activeDays), hint: 'son 26 haftada' },
    { icon: Sparkles, label: 'Hedef günü', value: formatNumber(data.goalDays), hint: `${goal} XP ve üstü` },
    { icon: Flame, label: 'Seri', value: `${streak.current} gün`, hint: `En iyi serin ${streak.best} gün` },
    {
      icon: Trophy,
      label: 'En iyi gün',
      value: data.best ? `${formatNumber(data.best.activity.xp)} XP` : '—',
      hint: data.best ? shortDate(data.best.key) : 'Henüz yok',
    },
  ];

  return (
    <ChartCard
      title="Çalışma takvimi"
      description="Son 26 hafta. Her kare bir gün; renk, o gün kazandığın XP’yi günlük hedefine göre gösterir."
      table={
        activeRows.length ? (
          <DataTable
            caption="Çalıştığın günler"
            columns={[
              { key: 'date', label: 'Tarih' },
              { key: 'xp', label: 'XP', align: 'right' },
              { key: 'lessons', label: 'Ders', align: 'right' },
              { key: 'reviews', label: 'Tekrar', align: 'right' },
              { key: 'checks', label: 'Soru', align: 'right' },
              { key: 'time', label: 'Süre', align: 'right' },
            ]}
            rows={activeRows}
          />
        ) : (
          <p className="text-sm text-muted">Son 26 haftada çalışılan gün yok.</p>
        )
      }
    >
      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 max-w-[820px]">
          <div className="grid grid-cols-[2rem_repeat(26,minmax(0,1fr))] gap-[3px]" aria-hidden>
            {data.monthLabels.map((m) => (
              <span
                key={`${m.week}-${m.label}`}
                className="whitespace-nowrap text-[11px] text-subtle"
                style={{ gridColumn: `${m.week + 2} / span 3`, gridRow: 1 }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            role="grid"
            aria-label="Çalışma takvimi: satırlar haftanın günleri, sütunlar haftalar"
            onKeyDown={onKeyDown}
            className="mt-1.5 grid grid-cols-[2rem_repeat(26,minmax(0,1fr))] gap-[3px]"
          >
            {Array.from({ length: 7 }, (_, d) => (
              <div role="row" key={d} className="contents">
                <span role="rowheader" className="self-center text-[11px] leading-none text-subtle">
                  <span aria-hidden className={d % 2 ? 'invisible' : undefined}>
                    {WEEKDAYS_SHORT[d]}
                  </span>
                  <span className="sr-only">{WEEKDAYS_SHORT[d]}</span>
                </span>
                {weeks.map((week, w) => {
                  const day = week[d];
                  const focusable = w === pos.w && d === pos.d;
                  return (
                    <div
                      key={day.key}
                      ref={(el) => {
                        if (el) cells.current.set(`${w}-${d}`, el);
                        else cells.current.delete(`${w}-${d}`);
                      }}
                      role="gridcell"
                      tabIndex={day.future ? undefined : focusable ? 0 : -1}
                      aria-label={cellLabel(day, goal)}
                      aria-current={day.today ? 'date' : undefined}
                      onFocus={(e) => {
                        setPos({ w, d });
                        show(day, e.currentTarget);
                      }}
                      onBlur={() => setShown(null)}
                      onMouseEnter={(e) => !day.future && show(day, e.currentTarget)}
                      onMouseLeave={() => setShown(null)}
                      className={clsx(
                        'aspect-square rounded-[4px] outline-none transition-transform duration-150',
                        day.future ? 'border border-border/60' : 'hover:scale-[1.15] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                        day.today && 'ring-2 ring-fg/60 ring-offset-1 ring-offset-surface',
                      )}
                      style={day.future ? undefined : { background: LEVEL_BG[day.level] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-subtle">
            <span>Günlük XP</span>
            {legendRanges.map((r) => (
              <span key={r.level} className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-[3px]" style={{ background: LEVEL_BG[r.level] }} aria-hidden />
                <span className="lx-tabular">{r.text}</span>
              </span>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 self-start @4xl:grid-cols-1">
          {stats.map(({ icon: Icon, label, value, hint }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-3.5 py-2.5">
              <Icon className="size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-base font-semibold text-fg lx-tabular">{value}</dd>
                <dd className="truncate text-[11px] text-subtle">{hint}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <FloatingCard anchor={shown?.rect ?? null} side="top" className="">
        {shown && <DayCard day={shown.day} goal={goal} />}
      </FloatingCard>
    </ChartCard>
  );
}
