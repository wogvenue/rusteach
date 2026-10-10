// Module page side cards: practice shortcut (spaced repetition + accuracy) and the
// previous / next module navigation.
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Crown, Dumbbell, Layers, Lock } from 'lucide-react';
import { Button } from '../../ui/Button';
import { fmtNum, fmtPct } from '../turkish';
import { STATUS_LABEL } from '../stats';
import { tierVars } from '../RegionBanner';
import { moduleAccuracy, moduleStatus, type ProgressData } from '../../../store/progress';
import { getTier, nextModule, prevModule } from '../../../lib/content';
import type { Module } from '../../../types/content';
import { moduleSolvedExercises, moduleSrs, moduleTotals } from './moduleInfo';

export function PracticeCard({ s, m, locked }: { s: ProgressData; m: Module; locked: boolean }) {
  const navigate = useNavigate();
  const srs = moduleSrs(s, m);
  const acc = moduleAccuracy(s, m.id);
  const totals = moduleTotals(m);
  const solved = moduleSolvedExercises(s, m);
  const mistakes = Object.values(s.mistakes).filter((x) => x.moduleId === m.id && !x.resolved).length;
  const started = m.lessonIds.some((id) => s.lessons[id]);

  return (
    <section aria-labelledby="practice-title" className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-info" aria-hidden>
          <Dumbbell className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="practice-title" className="text-[15px] font-semibold leading-6 text-fg">
            Pekiştir
          </h2>
          <p className="text-[13px] leading-5 text-muted">Karışık sorular, kalıcı öğrenme</p>
        </div>
      </div>

      {started ? (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="İlk denemede doğru" value={acc === null ? '–' : fmtPct(acc)} />
          <Stat label="Çözülen alıştırma" value={totals.exercises ? `${fmtNum(solved)}/${fmtNum(totals.exercises)}` : '–'} />
          <Stat label="Tekrar kartı" value={fmtNum(srs.cards)} />
          <Stat
            label="Bekleyen hata"
            value={fmtNum(mistakes)}
            tone={mistakes > 0 ? 'text-warning' : undefined}
          />
        </dl>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          Derslerde yanlış yaptığın sorular ve öğrendiğin kartlar burada birikir; antrenmanda modülleri karıştırarak
          tekrar edersin.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {srs.due > 0 && (
          <Button block icon={<Layers className="size-4" />} onClick={() => navigate('/tekrar')}>
            {fmtNum(srs.due)} kartı tekrar et
          </Button>
        )}
        <Button
          block
          variant={srs.due > 0 ? 'secondary' : started ? 'primary' : 'secondary'}
          icon={<Dumbbell className="size-4" />}
          disabled={locked && !started}
          onClick={() => navigate(`/antrenman?modul=${m.id}`)}
        >
          Bu modülle antrenman yap
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[11.5px] font-medium leading-4 text-muted">{label}</dt>
      <dd className={clsx('mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em]', tone ?? 'text-fg')}>{value}</dd>
    </div>
  );
}

export function ModuleNav({ s, m }: { s: ProgressData; m: Module }) {
  const prev = prevModule(m);
  const next = nextModule(m);
  if (!prev && !next) return null;
  return (
    <nav aria-label="Diğer modüller" className="grid gap-3 @2xl:grid-cols-2">
      {prev ? <NavCard s={s} m={prev} dir="prev" /> : <span className="hidden @2xl:block" />}
      {next && <NavCard s={s} m={next} dir="next" />}
    </nav>
  );
}

function NavCard({ s, m, dir }: { s: ProgressData; m: Module; dir: 'prev' | 'next' }) {
  const status = moduleStatus(s, m);
  const tier = getTier(m.tier);
  const locked = status === 'locked';
  const Arrow = dir === 'prev' ? ArrowLeft : ArrowRight;
  return (
    <Link
      to={`/modul/${m.id}`}
      style={tierVars(tier?.color ?? m.color)}
      className={clsx(
        'group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2',
        dir === 'next' && 'flex-row-reverse text-right',
      )}
    >
      <Arrow className="size-5 shrink-0 text-subtle transition-transform duration-200 group-hover:text-fg motion-safe:group-hover:translate-x-0.5" aria-hidden />
      <span
        className={clsx('grid size-11 shrink-0 place-items-center rounded-xl text-[22px]', locked && 'grayscale opacity-70')}
        style={{ background: locked ? 'var(--c-surface-2)' : 'color-mix(in oklab, var(--tier) 18%, var(--c-surface))' }}
        aria-hidden
      >
        {m.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted">
          {dir === 'prev' ? 'Önceki modül' : 'Sonraki modül'}: Modül {m.number}
        </span>
        <span className={clsx('mt-0.5 block truncate text-[15px] font-semibold', locked ? 'text-muted' : 'text-fg')}>{m.title}</span>
        <span
          className={clsx(
            'mt-0.5 inline-flex items-center gap-1 text-xs',
            status === 'mastered' ? 'font-medium text-gold' : 'text-subtle',
          )}
        >
          {status === 'mastered' && <Crown className="size-3" aria-hidden />}
          {locked && <Lock className="size-3" aria-hidden />}
          {STATUS_LABEL[status]}
        </span>
      </span>
    </Link>
  );
}
