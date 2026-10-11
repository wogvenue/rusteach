// Confidence calibration: for each confidence level, the share of answers that were correct, next to
// what a well-calibrated learner would score. Explains calibration and the hypercorrection effect.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleCheck, CircleHelp, Lightbulb, Sparkles, Zap } from 'lucide-react';
import clsx from 'clsx';
import { CALIBRATION_TARGET, calibrationVerdict, formatNumber, formatPercent, type CalibrationData, type CalibrationRow } from '../../lib/stats';
import { Tooltip } from '../ui/Tooltip';
import { ChartCard, DataTable, LegendItem } from './chartKit';

const BAR_H = 168;

function rowText(r: CalibrationRow): string {
  const target = formatPercent(CALIBRATION_TARGET[r.level]);
  if (!r.n) return `${r.label}: henüz cevap yok. İyi ayarlı bir öğrenci için beklenen yaklaşık ${target}.`;
  return `${r.label}: ${r.n} cevabın ${r.correct} tanesi doğru (${formatPercent(r.rate)}). İyi ayarlı bir öğrenci için beklenen yaklaşık ${target}.`;
}

function Column({ r, index }: { r: CalibrationRow; index: number }) {
  const target = CALIBRATION_TARGET[r.level];
  const rate = r.rate ?? 0;
  return (
    <li className="flex min-w-0 flex-col items-center">
      <Tooltip content={rowText(r)}>
        <div
          tabIndex={0}
          aria-label={rowText(r)}
          className="flex flex-col items-center rounded-2xl px-2 pb-1 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className={clsx('mb-2 text-lg font-semibold tracking-tight lx-tabular', r.n ? 'text-fg' : 'text-subtle')}>{r.n ? formatPercent(r.rate) : '-'}</div>
          <div className="relative w-14 rounded-xl bg-[color-mix(in_oklab,var(--c-fg)_7%,transparent)]" style={{ height: BAR_H }} aria-hidden>
            {r.n > 0 && (
              <motion.div
                className="absolute inset-x-0 bottom-0 rounded-xl"
                style={{ background: 'var(--lx-chart-1)' }}
                initial={{ height: 0 }}
                animate={{ height: Math.max(6, rate * BAR_H) }}
                transition={{ type: 'spring', stiffness: 110, damping: 20, delay: 0.08 * index }}
              />
            )}
            <div className="absolute -inset-x-2 border-t-2 border-dashed border-fg/55" style={{ bottom: target * BAR_H - 1 }} />
          </div>
        </div>
      </Tooltip>
      <div className="mt-2 text-center text-xs font-semibold text-fg">{r.label}</div>
      <div className="text-center text-[11px] text-subtle">{r.n ? `${formatNumber(r.n)} cevap` : 'cevap yok'}</div>
    </li>
  );
}

export default function CalibrationChart({ data, className }: { data: CalibrationData; className?: string }) {
  const verdict = useMemo(() => calibrationVerdict(data), [data]);
  const VerdictIcon = verdict.tone === 'good' ? CircleCheck : verdict.tone === 'focus' ? Zap : CircleHelp;

  return (
    <ChartCard
      className={className}
      title="Güven ayarın"
      description="Bir soruya “ne kadar emindim” dediğinde gerçekte ne kadar doğru cevapladığın."
      legend={
        data.total ? (
          <>
            <LegendItem color="var(--lx-chart-1)" label="Senin doğruluğun" />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="w-4 border-t-2 border-dashed border-fg/55" aria-hidden />
              İyi ayarlı bir öğrenci
            </span>
          </>
        ) : undefined
      }
      table={
        data.total ? (
          <DataTable
            caption="Güven seviyesine göre doğruluk"
            columns={[
              { key: 'level', label: 'Güven' },
              { key: 'n', label: 'Cevap', align: 'right' },
              { key: 'rate', label: 'Doğru', align: 'right' },
              { key: 'target', label: 'Beklenen', align: 'right' },
            ]}
            rows={data.rows.map((r) => ({ level: r.label, n: r.n, rate: r.n ? formatPercent(r.rate) : '-', target: formatPercent(CALIBRATION_TARGET[r.level]) }))}
          />
        ) : undefined
      }
    >
      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col">
          <ul className="grid grid-cols-3 items-end gap-2" aria-label="Güven seviyesine göre doğruluk">
            {data.rows.map((r, i) => (
              <Column key={r.level} r={r} index={i} />
            ))}
          </ul>
          <div
            className={clsx(
              'mt-5 flex gap-3 rounded-2xl border px-4 py-3',
              verdict.tone === 'good' ? 'border-success/30 bg-success-soft' : verdict.tone === 'focus' ? 'border-accent/30 bg-accent-soft' : 'border-border bg-surface-2/70',
            )}
          >
            <VerdictIcon
              className={clsx('mt-0.5 size-4 shrink-0', verdict.tone === 'good' ? 'text-success' : verdict.tone === 'focus' ? 'text-accent' : 'text-muted')}
              aria-hidden
            />
            <div>
              <div className="text-sm font-semibold text-fg">{verdict.title}</div>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{verdict.text}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-2/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Lightbulb className="size-4 text-gold" aria-hidden />
              Kalibrasyon nedir?
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Ne kadar emin olduğunla ne kadar doğru cevapladığının örtüşmesi. İyi ayarlı biri “çok eminim” dediğinde neredeyse hep haklıdır,
              “tahmin ediyorum” dediğinde ise sık sık yanılır. Ne bildiğini ve ne bilmediğini ayırt edebilmek, neyi tekrar etmen gerektiğini doğru
              seçmeni sağlar.
            </p>
          </div>
          <div className="rounded-2xl bg-surface-2/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Sparkles className="size-4 text-accent" aria-hidden />
              Emin olduğun hatalar değerlidir
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Çok emin olduğun bir cevapta yanıldığını görmek seni şaşırtır; bu şaşkınlık dikkatini keskinleştirir. Araştırmalar, böyle düzeltilen
              yanlışların az emin olunan yanlışlardan daha kalıcı biçimde düzeldiğini gösteriyor. Buna <strong className="font-semibold text-fg">hiperdüzeltme etkisi</strong> denir.
            </p>
            {data.confidentErrors.length > 0 && (
              <p className="mt-3 text-sm text-fg">
                “Çok emindim” deyip yanıldığın <span className="font-semibold lx-tabular">{data.confidentErrors.length}</span> soru var.{' '}
                <Link to="/antrenman?sekme=hata" className="font-semibold text-accent underline-offset-2 hover:underline">
                  Hata defterinde gözden geçir
                </Link>
              </p>
            )}
            {data.luckyGuesses.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-subtle">
                Tahminle doğru bildiğin {data.luckyGuesses.length} soru tekrar listene eklendi; şans eseri bilinen bir cevap henüz öğrenilmiş sayılmaz.
              </p>
            )}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
