// XP earned per day over the last 30 days, with the daily goal as a dashed reference line.
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { formatNumber, longDate, summarizeXp, type XpDay } from '../../lib/stats';
import { AXIS_TICK, type ChartTooltipProps, ChartCard, DataTable, GRID_STROKE, niceTicks, TooltipBox, useChartAnimation } from './chartKit';

function XpBar({ x, y, width, height, payload }: BarShapeProps) {
  if (!height || height <= 0 || !width) return null;
  const day = payload as XpDay;
  const r = Math.min(4, width / 2, height);
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return <path d={d} fill="var(--lx-chart-1)" fillOpacity={day.goalMet ? 1 : 0.55} />;
}

function XpTooltip({ active, payload, goal }: ChartTooltipProps & { goal: number }) {
  const day = payload?.[0]?.payload as XpDay | undefined;
  if (!active || !day) return null;
  return (
    <TooltipBox
      title={longDate(day.key)}
      rows={[{ label: 'Kazanılan XP', value: formatNumber(day.xp), color: 'var(--lx-chart-1)' }]}
      note={day.xp === 0 ? 'Bu gün çalışma yok' : day.goalMet ? 'Günlük hedefe ulaştın' : `Hedefe ${formatNumber(goal - day.xp)} XP kalmıştı`}
    />
  );
}

export default function XpChart({ days, goal, className }: { days: XpDay[]; goal: number; className?: string }) {
  const animate = useChartAnimation();
  const sum = useMemo(() => summarizeXp(days), [days]);
  const ticks = useMemo(() => niceTicks(Math.max(goal * 1.15, ...days.map((d) => d.xp))), [days, goal]);
  const tickEvery = 5;

  const facts = [
    { label: 'Toplam', value: `${formatNumber(sum.total)} XP` },
    { label: 'Aktif gün başına', value: sum.perActiveDay ? `${formatNumber(sum.perActiveDay)} XP` : '—' },
    { label: 'Hedef günü', value: `${sum.goalDays}/${days.length}` },
  ];

  return (
    <ChartCard
      className={className}
      title="Günlük XP"
      description="Son 30 gün. Koyu çubuklar günlük hedefine ulaştığın günler."
      empty={sum.total === 0 ? 'Son 30 günde XP kazanmadın. Bir ders ya da kısa bir tekrar bu grafiği hemen doldurmaya başlar.' : undefined}
      table={
        <DataTable
          caption="Son 30 günün XP’si"
          columns={[
            { key: 'date', label: 'Tarih' },
            { key: 'xp', label: 'XP', align: 'right' },
            { key: 'goal', label: 'Hedef', align: 'right' },
          ]}
          rows={[...days].reverse().map((d) => ({ date: longDate(d.key), xp: formatNumber(d.xp), goal: d.goalMet && d.xp > 0 ? 'Ulaşıldı' : '—' }))}
        />
      }
    >
      <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-2">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-muted">{f.label}</dt>
            <dd className="text-lg font-semibold tracking-tight text-fg lx-tabular">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div role="img" aria-label={`Son 30 günde toplam ${formatNumber(sum.total)} XP; ${sum.goalDays} gün günlük hedefe ulaşıldı.`}>
        <BarChart data={days} responsive style={{ width: '100%', height: 210 }} margin={{ top: 8, right: 16, bottom: 0, left: -18 }} barCategoryGap="22%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--c-border-strong)' }}
            interval={0}
            tickFormatter={(v: string, i: number) => (i % tickEvery === (days.length - 1) % tickEvery ? (i === days.length - 1 ? 'Bugün' : v) : '')}
            height={26}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} allowDecimals={false} width={48} />
          <Tooltip cursor={{ fill: 'var(--c-fg)', fillOpacity: 0.05 }} content={(p) => <XpTooltip {...p} goal={goal} />} isAnimationActive={false} />
          <ReferenceLine
            y={goal}
            stroke="var(--c-muted)"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: `Hedef ${goal}`, position: 'insideTopRight', fill: 'var(--c-muted)', fontSize: 11, dy: -14 }}
          />
          <Bar dataKey="xp" shape={XpBar} isAnimationActive={animate} animationDuration={700} />
        </BarChart>
      </div>
    </ChartCard>
  );
}
