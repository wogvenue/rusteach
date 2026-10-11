// Reviews due per day for the next 30 days, stacked by kind (flashcards and resurfaced checks).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { formatNumber, longDate, summarizeForecast, type ForecastDay } from '../../lib/stats';
import { estimateMinutes } from '../../lib/practice';
import { AXIS_TICK, type ChartTooltipProps, ChartCard, DataTable, GRID_STROKE, LegendItem, niceTicks, StackSegment, TooltipBox, useChartAnimation } from './chartKit';

const C_CARDS = 'var(--lx-chart-1)';
const C_CHECKS = 'var(--lx-chart-2)';

function minutesFor(d: ForecastDay): number {
  return estimateMinutes([
    ...Array.from({ length: d.flashcards }, () => ({ kind: 'flashcard' as const })),
    ...Array.from({ length: d.checks }, () => ({ kind: 'check' as const })),
  ]);
}

function ForecastTooltip({ active, payload }: ChartTooltipProps) {
  const d = payload?.[0]?.payload as ForecastDay | undefined;
  if (!active || !d) return null;
  return (
    <TooltipBox
      title={d.offset === 0 ? 'Bugün' : d.offset === 1 ? `Yarın, ${longDate(d.key)}` : longDate(d.key)}
      rows={[
        { label: 'Kartlar', value: d.flashcards, color: C_CARDS },
        { label: 'Sorular', value: d.checks, color: C_CHECKS },
      ]}
      note={d.total ? `Yaklaşık ${minutesFor(d)} dk` : 'Bu gün tekrar yok'}
    />
  );
}

export default function ForecastChart({ days, className }: { days: ForecastDay[]; className?: string }) {
  const animate = useChartAnimation();
  const sum = useMemo(() => summarizeForecast(days), [days]);
  const rows = useMemo(() => days.map((d) => ({ ...d, cardsTop: d.checks === 0 })), [days]);
  const ticks = useMemo(() => niceTicks(Math.max(4, ...days.map((d) => d.total)), 4), [days]);

  const facts = [
    { label: 'Bugün', value: formatNumber(sum.today) },
    { label: '7 gün', value: formatNumber(sum.week) },
    { label: '30 gün', value: formatNumber(sum.total) },
    { label: 'En yoğun gün', value: sum.peak ? `${sum.peak.offset === 0 ? 'Bugün' : sum.peak.offset === 1 ? 'Yarın' : sum.peak.label} (${sum.peak.total})` : '-' },
  ];

  return (
    <ChartCard
      className={className}
      title="Tekrar takvimi"
      description="Önümüzdeki 30 günde hangi gün kaç kartın ve sorunun tekrarı geleceği. Bugünkü sütun gecikmiş tekrarları da içerir."
      legend={
        <>
          <LegendItem color={C_CARDS} label="Kartlar" />
          <LegendItem color={C_CHECKS} label="Yeniden sorulacak sorular" />
        </>
      }
      empty={
        sum.total === 0 ? (
          <span>
            Önümüzdeki 30 günde tekrar yok. Ders bitirdikçe kartlar eklenir; yanlış ya da tahminle cevapladığın sorular da buraya düşer.
          </span>
        ) : undefined
      }
      table={
        <DataTable
          caption="Önümüzdeki 30 günün tekrarları"
          columns={[
            { key: 'date', label: 'Gün' },
            { key: 'cards', label: 'Kart', align: 'right' },
            { key: 'checks', label: 'Soru', align: 'right' },
            { key: 'total', label: 'Toplam', align: 'right' },
          ]}
          rows={days.filter((d) => d.total).map((d) => ({ date: d.offset < 2 ? d.label : longDate(d.key), cards: d.flashcards, checks: d.checks, total: d.total }))}
        />
      }
      footer={
        sum.today > 0 ? (
          <span>
            Bugün {sum.today} tekrar seni bekliyor.{' '}
            <Link to="/tekrar" className="font-semibold text-accent underline-offset-2 hover:underline">
              Tekrara başla
            </Link>
          </span>
        ) : undefined
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
      <div role="img" aria-label={`Önümüzdeki 7 günde ${sum.week}, 30 günde ${sum.total} tekrar var.`}>
        <BarChart data={rows} responsive style={{ width: '100%', height: 200 }} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="key"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--c-border-strong)' }}
            interval={0}
            tickFormatter={(_: string, i: number) => {
              const d = days[i];
              if (!d) return '';
              if (d.offset === 0) return 'Bugün';
              return d.offset % 5 === 0 ? d.label : '';
            }}
            height={26}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} width={48} />
          <Tooltip cursor={{ fill: 'var(--c-fg)', fillOpacity: 0.05 }} content={(p) => <ForecastTooltip {...p} />} isAnimationActive={false} />
          <Bar
            dataKey="flashcards"
            stackId="due"
            fill={C_CARDS}
            isAnimationActive={animate}
            animationDuration={700}
            shape={(p: BarShapeProps) => <StackSegment {...p} top={(p.payload as { cardsTop: boolean }).cardsTop} />}
          />
          <Bar
            dataKey="checks"
            stackId="due"
            fill={C_CHECKS}
            isAnimationActive={animate}
            animationDuration={700}
            shape={(p: BarShapeProps) => <StackSegment {...p} top />}
          />
        </BarChart>
      </div>
    </ChartCard>
  );
}
