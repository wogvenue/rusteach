// Memory strength: average recall probability of the reviewed cards, how they split into strong /
// fading / weak, what would remain without reviews, and the learner's forgetting curve with the recall
// rates actually measured in the review history.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber, formatPercent, type MemorySnapshot, type RetentionPoint } from '../../lib/stats';
import { REQUEST_RETENTION } from '../../lib/srs';
import { ProgressRing } from '../ui/primitives';
import { AXIS_TICK, type ChartTooltipProps, ChartCard, DataTable, GRID_STROKE, LegendItem, TooltipBox, useChartAnimation } from './chartKit';

const C_TYPICAL = 'var(--lx-chart-1)';
const C_FRESH = 'var(--lx-chart-muted)';
const C_MEASURED = 'var(--lx-chart-2)';

export interface RetentionData {
  points: RetentionPoint[];
  stability: number;
  illustrative: boolean;
}

function formatDays(d: number): string {
  if (d < 1) return '1 günden az';
  if (d < 60) return `${formatNumber(d)} gün`;
  if (d < 365) return `${formatNumber(d / 30)} ay`;
  return `${(d / 365).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} yıl`;
}

function RetentionTooltip({ active, payload, illustrative }: ChartTooltipProps & { illustrative: boolean }) {
  const p = payload?.[0]?.payload as RetentionPoint | undefined;
  if (!active || !p) return null;
  const rows = [
    { label: illustrative ? 'Düzenli tekrar edilen bilgi' : 'Senin tipik kartın', value: formatPercent(p.typical), color: C_TYPICAL },
    { label: 'Bir kez görülen bilgi', value: formatPercent(p.fresh), color: C_FRESH },
  ];
  if (p.measured !== undefined) rows.push({ label: `Ölçülen (${p.measuredLabel})`, value: formatPercent(p.measured), color: C_MEASURED });
  return (
    <TooltipBox
      title={p.day === 0 ? 'Tekrar anı' : `${p.day} gün sonra`}
      rows={rows}
      note={p.measuredN ? `${p.measuredN} tekrardan ölçüldü` : 'Hatırlama olasılığı'}
    />
  );
}

function Distribution({ snap }: { snap: MemorySnapshot }) {
  const parts = [
    { key: 'strong', label: 'Sağlam', hint: '%90 ve üstü', n: snap.strong, cls: 'bg-success' },
    { key: 'medium', label: 'Soluyor', hint: '%70–90', n: snap.medium, cls: 'bg-warning' },
    { key: 'weak', label: 'Zayıf', hint: '%70 altı', n: snap.weak, cls: 'bg-danger' },
  ];
  const total = Math.max(1, snap.reviewed);
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c-fg)_8%,transparent)]" aria-hidden>
        {parts.map(
          (p, i) =>
            p.n > 0 && (
              <motion.div
                key={p.key}
                className={p.cls}
                initial={{ width: 0 }}
                animate={{ width: `${(p.n / total) * 100}%` }}
                transition={{ type: 'spring', stiffness: 110, damping: 22, delay: 0.06 * i }}
              />
            ),
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-2 rounded-full ${p.cls}`} aria-hidden />
              {p.label}
            </dt>
            <dd className="mt-0.5 text-base font-semibold leading-tight text-fg lx-tabular">{formatNumber(p.n)}</dd>
            <dd className="text-[11px] text-subtle">{p.hint}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MemoryStrength({
  snap,
  retention,
  projected,
  className,
}: {
  snap: MemorySnapshot;
  retention: RetentionData;
  projected: { week: number | null; month: number | null };
  className?: string;
}) {
  const animate = useChartAnimation();
  const measured = useMemo(() => retention.points.filter((p) => p.measured !== undefined), [retention.points]);
  const yTicks = useMemo(() => {
    let min = 1;
    for (const p of retention.points) min = Math.min(min, p.typical, p.fresh, p.measured ?? 1);
    const step = min >= 0.5 ? 0.1 : 0.25;
    const lo = Math.max(0, Math.floor((min - 0.02) / step) * step);
    const out: number[] = [];
    for (let v = lo; v <= 1.0001; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [retention.points]);
  const hasCards = snap.reviewed > 0;
  const avg = snap.avgRetrievability ?? 0;

  return (
    <ChartCard
      className={className}
      title="Hafıza gücü"
      description="Tekrar ettiğin kartları şu an ne kadar iyi hatırladığın ve tekrar etmezsen bu bilginin nasıl solacağı."
      legend={
        <>
          <LegendItem color={C_TYPICAL} kind="line" label={retention.illustrative ? 'Düzenli tekrar edilen bilgi' : 'Senin tipik kartın'} />
          <LegendItem color={C_FRESH} kind="line" label="Bir kez görülen bilgi" />
          {measured.length > 0 && <LegendItem color={C_MEASURED} kind="dot" label="Gerçekte hatırladığın" />}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="w-4 border-t border-dashed border-muted" aria-hidden />
            Hedef: %90
          </span>
        </>
      }
      table={
        <DataTable
          caption="Unutma eğrisi"
          columns={[
            { key: 'day', label: 'Gün' },
            { key: 'typical', label: retention.illustrative ? 'Düzenli' : 'Tipik kart', align: 'right' },
            { key: 'fresh', label: 'Bir kez', align: 'right' },
            { key: 'measured', label: 'Ölçülen', align: 'right' },
          ]}
          rows={retention.points
            .filter((p) => p.day % 3 === 0 || p.measured !== undefined)
            .map((p) => ({
              day: p.day === 0 ? 'Tekrar anı' : `${p.day}. gün`,
              typical: formatPercent(p.typical),
              fresh: formatPercent(p.fresh),
              measured: p.measured !== undefined ? `${formatPercent(p.measured)} (${p.measuredN})` : '-',
            }))}
        />
      }
      footer={
        retention.illustrative
          ? 'Eğriler örnek; ilk tekrarlarından sonra senin kartlarına göre çizilir. %90 hedefi, zamanlayıcının kartı sana tekrar göstermeden önce izin verdiği en düşük hatırlama olasılığı.'
          : `Tipik kartının kararlılığı ${formatDays(retention.stability)}: bu sürenin sonunda hatırlama olasılığı %90’a iner. %90 hedefi, zamanlayıcının kartı tekrar göstermeden önce izin verdiği en düşük olasılık.`
      }
    >
      <div className="grid gap-5 @2xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <ProgressRing value={avg} size={76} stroke={7} color="var(--lx-chart-1)" label="Ortalama hatırlama olasılığı">
              <span className="text-lg font-semibold tracking-tight text-fg">{hasCards ? formatPercent(avg) : '-'}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-snug text-fg">Ortalama hatırlama</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {hasCards
                  ? `${formatNumber(snap.reviewed)} kartın şu anki ortalaması`
                  : 'İlk tekrarından sonra hesaplanır.'}
              </p>
            </div>
          </div>
          {hasCards ? (
            <>
              <Distribution snap={snap} />
              <div className="rounded-2xl bg-surface-2/70 px-4 py-3">
                <div className="text-xs font-medium text-muted">Hiç tekrar etmezsen</div>
                <div className="mt-1.5 flex gap-6">
                  <div>
                    <div className="text-lg font-semibold tracking-tight text-fg lx-tabular">{formatPercent(projected.week)}</div>
                    <div className="text-[11px] text-subtle">1 hafta sonra</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tracking-tight text-fg lx-tabular">{formatPercent(projected.month)}</div>
                    <div className="text-[11px] text-subtle">1 ay sonra</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-strong px-4 py-3 text-sm leading-relaxed text-muted">
              {snap.fresh > 0 ? `${formatNumber(snap.fresh)} kart ilk tekrarını bekliyor. ` : 'Ders bitirdikçe kartların buraya eklenir. '}
              <Link to="/tekrar" className="font-semibold text-accent underline-offset-2 hover:underline">
                Tekrar sayfasına git
              </Link>
            </div>
          )}
        </div>

        <div
          className="min-w-0"
          role="img"
          aria-label={
            retention.illustrative
              ? 'Örnek unutma eğrisi: bir kez görülen bilgi birkaç günde büyük ölçüde unutulur, düzenli tekrar edilen bilgi haftalarca yüksek kalır.'
              : `Unutma eğrisi: tipik kartın 30 gün sonra ${formatPercent(retention.points[retention.points.length - 1]?.typical)} olasılıkla hatırlanır; bir kez görülen bilgi ${formatPercent(retention.points[retention.points.length - 1]?.fresh)}.`
          }
        >
          <ComposedChart data={retention.points} responsive style={{ width: '100%', height: 230 }} margin={{ top: 10, right: 8, bottom: 0, left: -14 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, 30]}
              ticks={[0, 7, 14, 21, 30]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--c-border-strong)' }}
              tickFormatter={(v: number) => (v === 0 ? 'Bugün' : `${v}. gün`)}
              height={26}
            />
            <YAxis
              domain={[yTicks[0], 1]}
              ticks={yTicks}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatPercent(v)}
              width={52}
            />
            <ReferenceLine
              y={REQUEST_RETENTION}
              stroke="var(--c-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Tooltip
              cursor={{ stroke: 'var(--c-border-strong)', strokeWidth: 1 }}
              content={(p) => <RetentionTooltip {...p} illustrative={retention.illustrative} />}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fresh"
              stroke={C_FRESH}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3.5, fill: C_FRESH, stroke: 'var(--c-surface)', strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={900}
            />
            <Line
              type="monotone"
              dataKey="typical"
              stroke={C_TYPICAL}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: C_TYPICAL, stroke: 'var(--c-surface)', strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={900}
            />
            {measured.length > 0 && (
              <Line
                dataKey="measured"
                stroke="none"
                connectNulls={false}
                dot={{ r: 5, fill: C_MEASURED, stroke: 'var(--c-surface)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: C_MEASURED, stroke: 'var(--c-surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </div>
      </div>
    </ChartCard>
  );
}
