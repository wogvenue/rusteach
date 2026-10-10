// Module page hero: identity (number, icon, title, tier), description, progress ring, mastery
// status and the main call to action.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, ChevronsRight, Clock, Code2, Crown, Dumbbell, Layers, Lock, Play, RotateCcw, Swords } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge, ProgressRing } from '../../ui/primitives';
import TierScenery from '../TierScenery';
import { tierVars } from '../RegionBanner';
import { STATUS_LABEL } from '../stats';
import { fmtDate, fmtNum, fmtPct } from '../turkish';
import { BOSS_PASS_THRESHOLD, canTakeSkipTest, moduleProgress, type ModuleStatus, type ProgressData } from '../../../store/progress';
import { prevModule } from '../../../lib/content';
import type { Module, Tier } from '../../../types/content';
import { MODULE_STATUS_TONE, moduleNext, moduleTotals, lessonsDone } from './moduleInfo';

export default function ModuleHero({ s, m, tier, status }: { s: ProgressData; m: Module; tier?: Tier; status: ModuleStatus }) {
  const color = tier?.color ?? m.color;
  const totals = moduleTotals(m);
  const progress = moduleProgress(s, m);
  const done = lessonsDone(s, m);
  const locked = status === 'locked';
  const mastered = status === 'mastered';
  const mp = s.modules[m.id];

  return (
    <section
      aria-labelledby="module-title"
      className="glow-mesh relative isolate overflow-hidden rounded-3xl border p-6 shadow-card lg:p-8"
      style={{
        ...tierVars(color),
        ['--glow-color' as string]: locked ? 'var(--c-subtle)' : color,
        borderColor: locked ? 'var(--c-border)' : 'color-mix(in oklab, var(--tier) 28%, var(--c-border))',
      }}
    >
      {tier && (
        <TierScenery
          tierId={tier.id}
          color={color}
          muted={locked}
          strength={0.55}
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[46%] w-full"
        />
      )}

      <div className="flex flex-col gap-7 @3xl:flex-row @3xl:items-start">
        <div className="flex min-w-0 flex-1 gap-5">
          <ModuleIcon m={m} locked={locked} mastered={mastered} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('text-[13px] font-semibold', locked ? 'text-subtle' : 'tier-ink')}>Modül {m.number}</span>
              {tier && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    borderColor: 'color-mix(in oklab, var(--tier) 35%, transparent)',
                    background: 'color-mix(in oklab, var(--tier) 13%, transparent)',
                  }}
                >
                  <span aria-hidden>{tier.emoji}</span>
                  <span className="tier-ink">{tier.title}</span>
                </span>
              )}
              <Badge tone={MODULE_STATUS_TONE[status]}>
                {mastered && <Crown className="size-3" aria-hidden />}
                {locked && <Lock className="size-3" aria-hidden />}
                {STATUS_LABEL[status]}
              </Badge>
            </div>
            <h1 id="module-title" className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg">
              {m.title}
            </h1>
            {m.subtitle && <p className="mt-1.5 text-[16px] leading-6 text-muted">{m.subtitle}</p>}
            {m.description && (
              <div className="lesson-prose prose-sm mt-4 max-w-[64ch] text-muted" dangerouslySetInnerHTML={{ __html: m.description }} />
            )}

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted" aria-label="Modül içeriği">
              <Meta icon={<BookOpen className="size-4" />}>{fmtNum(totals.lessons)} ders</Meta>
              {totals.minutes > 0 && <Meta icon={<Clock className="size-4" />}>yaklaşık {fmtNum(totals.minutes)} dk</Meta>}
              {totals.exercises > 0 && <Meta icon={<Code2 className="size-4" />}>{fmtNum(totals.exercises)} alıştırma</Meta>}
              {totals.flashcards > 0 && <Meta icon={<Layers className="size-4" />}>{fmtNum(totals.flashcards)} kart</Meta>}
            </ul>

            <HeroActions s={s} m={m} status={status} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 @3xl:w-[200px] @3xl:flex-col @3xl:items-center @3xl:pt-1 @3xl:text-center">
          <ProgressRing
            value={mastered ? 1 : progress}
            size={128}
            stroke={10}
            color={mastered ? 'var(--c-gold)' : 'var(--tier)'}
            label="Modül ilerlemesi"
          >
            <span className="flex flex-col items-center">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-fg">{fmtPct(mastered ? 1 : progress)}</span>
              <span className="mt-1 text-[11px] font-medium text-muted">tamamlandı</span>
            </span>
          </ProgressRing>
          <div className="min-w-0 text-[13px] leading-5">
            <div className="font-semibold text-fg">
              {done}/{totals.lessons} ders bitti
            </div>
            <div className={clsx(mastered ? 'font-medium text-gold' : 'text-muted')}>
              {mastered
                ? mp?.masteredAt
                  ? `${fmtDate(mp.masteredAt)} tarihinde ustalaşıldı`
                  : 'Modülde ustalaştın'
                : mp?.bossAttempts
                  ? `Sınavda en iyi: ${fmtPct(mp.bossBest)}`
                  : m.bossId
                    ? `Ustalık için sınavda ${fmtPct(BOSS_PASS_THRESHOLD)}`
                    : 'Dersleri bitir, tekrarlarla pekiştir'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className="text-subtle" aria-hidden>
        {icon}
      </span>
      {children}
    </li>
  );
}

function ModuleIcon({ m, locked, mastered }: { m: Module; locked: boolean; mastered: boolean }) {
  return (
    <div className="relative hidden shrink-0 @lg:block">
      <div
        className={clsx(
          'grid size-[84px] place-items-center rounded-[26px] text-[44px] shadow-[0_6px_0_var(--edge),0_18px_30px_-14px_var(--edge)]',
          locked && 'grayscale',
        )}
        style={{
          ['--edge' as string]: locked ? 'var(--c-border-strong)' : 'color-mix(in oklab, var(--tier) 55%, #000)',
          background: locked
            ? 'var(--c-surface-2)'
            : 'radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--tier) 70%, #fff) 0%, var(--tier) 60%, color-mix(in oklab, var(--tier) 85%, #000) 100%)',
          opacity: locked ? 0.75 : 1,
        }}
        aria-hidden
      >
        <span className="drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)]">{m.icon}</span>
      </div>
      {mastered && (
        <span
          className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border-2 border-surface bg-gold text-[#2a1a00] shadow"
          aria-hidden
        >
          <Crown className="size-4" strokeWidth={2.4} />
        </span>
      )}
    </div>
  );
}

function HeroActions({ s, m, status }: { s: ProgressData; m: Module; status: ModuleStatus }) {
  const navigate = useNavigate();
  const practice = (
    <Button size="lg" variant="secondary" icon={<Dumbbell className="size-5" />} onClick={() => navigate(`/antrenman?modul=${m.id}`)}>
      Antrenman
    </Button>
  );

  if (status === 'locked') {
    const prev = prevModule(m);
    const skip = canTakeSkipTest(s, m) && m.bossId;
    return (
      <div className="mt-6 rounded-2xl border border-border bg-[color-mix(in_oklab,var(--c-surface)_80%,transparent)] p-4 backdrop-blur-sm">
        <p className="flex items-start gap-2.5 text-sm leading-6 text-fg">
          <Lock className="mt-1 size-4 shrink-0 text-subtle" aria-hidden />
          <span>
            Bu modül henüz kilitli.
            {prev ? ` Modül ${prev.number}: ${prev.title} sınavını geçince açılır.` : ''}
            {skip ? ' Konuyu zaten biliyorsan atlama sınavıyla doğrudan buradan devam edebilirsin.' : ''}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {skip && (
            <Button icon={<ChevronsRight className="size-4" />} onClick={() => navigate(`/ders/${m.bossId}?atlama=1`)}>
              Atlama sınavına gir
            </Button>
          )}
          {prev && (
            <Button variant={skip ? 'secondary' : 'primary'} onClick={() => navigate(`/modul/${prev.id}`)}>
              Modül {prev.number} sayfasına git
            </Button>
          )}
        </div>
      </div>
    );
  }

  const next = moduleNext(s, m);
  if (!next) return <div className="mt-6 flex flex-wrap gap-2.5">{practice}</div>;

  const label: Record<typeof next.kind, string> = {
    continue: 'Devam et',
    start: s.lessons[m.lessonIds[0]] ? 'Sıradaki derse başla' : 'Modüle başla',
    boss: 'Modül sınavına gir',
    review: 'Dersleri gözden geçir',
  };
  const icon =
    next.kind === 'boss' ? <Swords className="size-5" /> : next.kind === 'review' ? <RotateCcw className="size-5" /> : <Play className="size-5 fill-current" />;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2.5">
      {next.kind === 'review' ? (
        <>
          <Button size="lg" icon={<Dumbbell className="size-5" />} onClick={() => navigate(`/antrenman?modul=${m.id}`)}>
            Antrenman yap
          </Button>
          <Button size="lg" variant="secondary" icon={icon} onClick={() => navigate(`/ders/${next.lesson.id}`)}>
            {label.review}
          </Button>
        </>
      ) : (
        <>
          <Button size="lg" icon={icon} onClick={() => navigate(`/ders/${next.lesson.id}`)}>
            {label[next.kind]}
          </Button>
          {next.kind !== 'boss' && (
            <span className="min-w-0 truncate text-sm text-muted">
              <span className="sr-only">Sıradaki ders: </span>
              {next.lesson.title}
            </span>
          )}
        </>
      )}
    </div>
  );
}
