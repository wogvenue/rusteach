// Ana Sayfa: greeting, "Devam et", today's plan (reviews first), streak + heatmap, current region,
// a learning-science tip, quick stats and recent achievements.
import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BookOpen, Check, ChevronRight, Clock, Crown, Flame, Layers, Map as MapIcon, Play, Snowflake, Swords, Target, Trophy,
} from 'lucide-react';
import Ferris, { type FerrisMood } from '../components/Ferris';
import { Button } from '../components/ui/Button';
import { Badge, ProgressBar, SectionHeader } from '../components/ui/primitives';
import Heatmap from '../components/shell/Heatmap';
import TipCard from '../components/shell/TipCard';
import RegionBanner, { tierVars } from '../components/shell/RegionBanner';
import AchievementTile from '../components/shell/AchievementTile';
import { useNow } from '../components/shell/useNow';
import {
  completedLessonCount, currentTier, effectiveStreak, firstTryAccuracy, isBrandNew, journeyComplete, learnedCardCount,
  solvedExerciseCount, studiedToday, STATUS_LABEL,
} from '../components/shell/stats';
import { fmtDayLong, fmtDuration, fmtNum, fmtPct, greeting } from '../components/shell/turkish';
import {
  BOSS_PASS_THRESHOLD, dayKey, dueReviews, moduleProgress, moduleStatus, nextLessonId, todayActivity, useProgress, type ProgressState,
} from '../store/progress';
import { getLesson, getModule, getTier, modules, modulesOfTier, tiers, totals } from '../lib/content';
import { ACHIEVEMENTS, getAchievement } from '../lib/achievements';
import type { Lesson, Module } from '../types/content';

export default function Dashboard() {
  const s = useProgress();
  const now = useNow();
  const brandNew = isBrandNew(s);
  const g = greeting(now);
  const name = s.profile.name.trim();
  const today = todayActivity(s);
  const goalDone = !!today.goalBonus || today.xp >= s.settings.dailyGoalXp;

  const mood: FerrisMood = brandNew ? 'wave' : goalDone ? 'celebrate' : g.mood === 'night' ? 'sleep' : 'happy';

  return (
    <div className="@container mx-auto w-full max-w-[1240px] px-6 pb-14 pt-7 lg:px-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{fmtDayLong(now)}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-fg">
            {g.text}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
      </header>

      <div className="grid gap-5 @2xl:grid-cols-12">
        <ContinueHero s={s} mood={mood} brandNew={brandNew} className="@2xl:col-span-7 @5xl:col-span-8" />
        <TodayPlan s={s} now={now} className="@2xl:col-span-5 @5xl:col-span-4" />

        {brandNew ? (
          <HowItWorks className="@2xl:col-span-7 @5xl:col-span-8" />
        ) : (
          <ActivityCard s={s} now={now} className="@2xl:col-span-7 @5xl:col-span-8" />
        )}
        <TipCard className="@2xl:col-span-5 @5xl:col-span-4" />

        <CurrentRegion s={s} className={brandNew ? '@2xl:col-span-12' : '@2xl:col-span-7 @5xl:col-span-8'} />
        {!brandNew && <QuickStats s={s} className="@2xl:col-span-5 @5xl:col-span-4" />}

        {!brandNew && <Achievements s={s} className="@2xl:col-span-12" />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ hero

function ContinueHero({ s, mood, brandNew, className }: { s: ProgressState; mood: FerrisMood; brandNew: boolean; className?: string }) {
  const navigate = useNavigate();
  const nextId = nextLessonId(s);
  const lesson = nextId ? getLesson(nextId) : undefined;
  const module = lesson ? getModule(lesson.moduleId) : undefined;
  const tier = module ? getTier(module.tier) : undefined;
  const color = tier?.color ?? 'var(--c-accent)';

  let body: ReactNode;
  if (!modules.length) {
    body = (
      <HeroText
        eyebrow="Rusteach"
        title="Dersler yüklenemedi"
        text="Uygulamanın içerik paketi bulunamadı. Uygulamayı yeniden kurmak sorunu çözer."
      />
    );
  } else if (!lesson || !module) {
    const done = journeyComplete(s);
    body = (
      <>
        <HeroText
          eyebrow={done ? 'Yolculuk tamamlandı' : 'Her şey yolunda'}
          title={done ? 'Bütün modülleri ustalaştın' : 'Şimdilik açık ders kalmadı'}
          text={
            done
              ? 'Rust yolculuğunu baştan sona bitirdin. Sertifikan seni bekliyor; öğrendiklerini taze tutmak için tekrarlara devam et.'
              : 'Haritadan bir modül seç ya da tekrar ve antrenmanla bildiklerini sağlamlaştır.'
          }
        />
        <div className="mt-6 flex flex-wrap gap-2.5">
          {done ? (
            <Button size="lg" icon={<Trophy className="size-5" />} onClick={() => navigate('/profil#sertifika')}>
              Sertifikamı göster
            </Button>
          ) : (
            <Button size="lg" icon={<MapIcon className="size-5" />} onClick={() => navigate('/harita')}>
              Haritayı aç
            </Button>
          )}
          <Button size="lg" variant="secondary" icon={<Layers className="size-5" />} onClick={() => navigate('/tekrar')}>
            Tekrara geç
          </Button>
        </div>
      </>
    );
  } else {
    body = <NextLesson s={s} lesson={lesson} module={module} brandNew={brandNew} />;
  }

  return (
    <section
      aria-label="Kaldığın yer"
      className={clsx('glow-mesh relative isolate overflow-hidden rounded-3xl border border-border p-6 shadow-card lg:p-7', className)}
      style={{ ['--glow-color' as string]: color, ...(tier ? tierVars(tier.color) : {}) }}
    >
      <div className="pointer-events-none absolute -bottom-3 right-3 -z-10 hidden @lg:block" aria-hidden>
        <Ferris size={150} mood={mood} />
      </div>
      <div className="max-w-[min(520px,72%)]">{body}</div>
    </section>
  );
}

function HeroText({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <>
      <p className="tier-ink text-sm font-semibold">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">{title}</h2>
      <p className="mt-2 text-[15px] leading-6 text-muted">{text}</p>
    </>
  );
}

function NextLesson({ s, lesson, module, brandNew }: { s: ProgressState; lesson: Lesson; module: Module; brandNew: boolean }) {
  const navigate = useNavigate();
  const lp = s.lessons[lesson.id];
  const isBoss = lesson.type === 'boss';
  const inProgress = lp?.status === 'in_progress';
  const stepTotal = Math.max(1, lesson.steps.length);
  const stepPct = inProgress ? Math.min(1, (lp.step + 1) / stepTotal) : 0;
  const idx = module.lessonIds.indexOf(lesson.id);
  const progress = moduleProgress(s, module);
  // Free mode can resume a boss before its lessons are done; don't claim they all are.
  const allLessonsDone = module.lessonIds.every((id) => s.lessons[id]?.status === 'completed');

  const eyebrow = brandNew ? 'Yolculuğun burada başlıyor' : `Modül ${module.number}: ${module.title}`;
  const cta = isBoss ? 'Sınava gir' : inProgress ? 'Devam et' : brandNew ? 'İlk derse başla' : 'Başla';

  return (
    <>
      <p className="tier-ink text-sm font-semibold">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">
        {isBoss ? `${module.title}: Modül Sınavı` : lesson.title}
      </h2>
      <p className="mt-2 text-[15px] leading-6 text-muted">
        {brandNew
          ? `${module.title} modülüyle başlıyorsun. Kısa bir okuma, hemen ardından deneme ve sorular. Takıldığın yerde Ferris ipucu verir.`
          : isBoss
            ? `${allLessonsDone ? 'Modülün tüm derslerini bitirdin.' : 'Sınavı yarıda bıraktın.'} Karışık sorulardan ${fmtPct(BOSS_PASS_THRESHOLD)} alırsan modülü ustalaşırsın ve sıradaki açılır.`
            : inProgress
              ? `Kaldığın yerden devam et: ${stepTotal} adımın ${lp.step + 1}. adımındasın.`
              : `${module.title} modülünün ${idx + 1}. dersi. Yaklaşık ${lesson.minutes} dakika sürer.`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        {!isBoss && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-subtle" aria-hidden />
            {lesson.minutes} dk
          </span>
        )}
        {!isBoss && idx >= 0 && (
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-4 text-subtle" aria-hidden />
            Ders {idx + 1}/{module.lessonIds.length}
          </span>
        )}
        {lesson.type === 'project' && <Badge tone="info">Proje</Badge>}
        {isBoss && <Badge tone="gold">Sınav</Badge>}
      </div>

      {(inProgress || progress > 0) && (
        <div className="mt-4 max-w-[340px]">
          <ProgressBar
            value={inProgress ? stepPct : progress}
            color="var(--tier)"
            height={6}
            label={inProgress ? 'Ders ilerlemesi' : 'Modül ilerlemesi'}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button
          size="lg"
          icon={isBoss ? <Swords className="size-5" /> : <Play className="size-5 fill-current" />}
          onClick={() => navigate(`/ders/${lesson.id}`)}
        >
          {cta}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => navigate(`/modul/${module.id}`)}>
          Modülü gör
        </Button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ today's plan

function TodayPlan({ s, now, className }: { s: ProgressState; now: Date; className?: string }) {
  const due = dueReviews(s, now).length;
  const today = todayActivity(s);
  const goal = s.settings.dailyGoalXp;
  const goalDone = !!today.goalBonus || today.xp >= goal;
  const hasCards = Object.keys(s.srs).length > 0;
  const nextId = nextLessonId(s);
  const next = nextId ? getLesson(nextId) : undefined;

  const items: PlanItemProps[] = [];
  items.push({
    icon: <Layers className="size-4" />,
    done: hasCards && due === 0 && today.reviews > 0,
    title: due > 0 ? `${due} kartı tekrar et` : today.reviews > 0 ? 'Tekrarlar tamam' : 'Tekrar kartı yok',
    detail:
      due > 0
        ? 'Unutmak üzere olduklarını şimdi hatırlamak onları kalıcı yapar.'
        : hasCards
          ? today.reviews > 0
            ? `Bugün ${today.reviews} tekrar yaptın.`
            : 'Bugün sırası gelen kart yok.'
          : 'Kartlar derslerden sonra burada birikir.',
    to: due > 0 ? '/tekrar' : undefined,
    muted: !hasCards || (due === 0 && today.reviews === 0),
  });
  if (next) {
    const isBoss = next.type === 'boss';
    items.push({
      icon: isBoss ? <Swords className="size-4" /> : <BookOpen className="size-4" />,
      done: today.lessons > 0,
      title: today.lessons > 0 ? `Bugün ${today.lessons} ders bitirdin` : isBoss ? 'Modül sınavına gir' : 'Bir ders bitir',
      detail: today.lessons > 0 ? 'İstersen bir tane daha: sıradaki seni bekliyor.' : isBoss ? 'Tüm dersler bitti, sıra sınavda.' : next.title,
      to: `/ders/${next.id}`,
    });
  }
  items.push({
    icon: <Target className="size-4" />,
    done: goalDone,
    title: goalDone ? 'Günlük hedefe ulaştın' : `Günlük hedef: ${today.xp}/${goal} XP`,
    detail: goalDone ? `Bugün ${today.xp} XP topladın.` : `${Math.max(0, goal - today.xp)} XP kaldı. Hedefe ulaşınca +25 XP bonus.`,
    progress: goalDone ? undefined : Math.min(1, today.xp / Math.max(1, goal)),
  });

  const doneCount = items.filter((i) => i.done).length;

  return (
    <section aria-labelledby="plan-title" className={clsx('flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-card', className)}>
      <SectionHeader
        id="plan-title"
        title="Bugünün planı"
        action={
          <span className="text-[13px] font-semibold tabular-nums text-muted">
            {doneCount}/{items.length}
          </span>
        }
      />
      <ul className="mt-3 flex flex-1 flex-col gap-1">
        {items.map((it, i) => (
          <PlanItem key={i} {...it} />
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-subtle">
        Önce tekrar, sonra yeni ders: hatırlamaya çalışmak, yeni bilgiye zemin hazırlar.
      </p>
    </section>
  );
}

interface PlanItemProps {
  icon: ReactNode;
  done: boolean;
  title: string;
  detail: string;
  to?: string;
  progress?: number;
  muted?: boolean;
}

function PlanItem({ icon, done, title, detail, to, progress, muted }: PlanItemProps) {
  const inner = (
    <>
      <span
        className={clsx(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border transition-colors',
          done ? 'border-transparent bg-success text-on-success' : muted ? 'border-border text-subtle' : 'border-border-strong text-muted',
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-sm font-semibold', done ? 'text-muted line-through decoration-subtle/50' : muted ? 'text-muted' : 'text-fg')}>
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-5 text-muted">{detail}</span>
        {progress !== undefined && (
          <span className="mt-2 block">
            <ProgressBar value={progress} color="var(--c-xp)" height={5} label="Günlük hedef" />
          </span>
        )}
      </span>
      {to && !done && <ChevronRight className="mt-1.5 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />}
      <span className="sr-only">{done ? 'Tamamlandı.' : ''}</span>
    </>
  );
  return (
    <li>
      {to && !done ? (
        <Link to={to} className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2">
          {inner}
        </Link>
      ) : (
        <div className="-mx-2 flex items-start gap-3 px-2 py-2.5">{inner}</div>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ activity

function ActivityCard({ s, now, className }: { s: ProgressState; now: Date; className?: string }) {
  const todayKey = dayKey(now);
  const streak = effectiveStreak(s, todayKey);
  const doneToday = studiedToday(s, todayKey);
  const today = todayActivity(s);

  return (
    <section aria-labelledby="activity-title" className={clsx('rounded-3xl border border-border bg-surface p-5 shadow-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'grid size-12 place-items-center rounded-2xl',
              streak > 0 ? 'bg-[color-mix(in_oklab,var(--c-streak)_15%,transparent)] text-streak' : 'bg-surface-2 text-subtle',
            )}
            aria-hidden
          >
            <Flame className={clsx('size-7', streak > 0 && 'fill-current', doneToday && 'animate-flicker')} />
          </span>
          <div>
            <h2 id="activity-title" className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
              {streak > 0 ? `${streak} günlük seri` : 'Seri başlat'}
            </h2>
            <p className="text-[13px] text-muted">
              {doneToday
                ? 'Bugünkü çalışmanı yaptın.'
                : streak > 0
                  ? 'Bugün çalışırsan seri devam eder.'
                  : 'Bugün bir ders ya da birkaç tekrar yeter.'}
            </p>
          </div>
        </div>
        <dl className="flex gap-5 text-right">
          <Stat label="En uzun seri" value={`${s.streak.best} gün`} />
          <Stat
            label="Seri dondurma"
            value={
              <span className="inline-flex items-center gap-1">
                <Snowflake className="size-3.5 text-info" aria-hidden />
                {s.streak.freezes}/2
              </span>
            }
          />
          <Stat label="Bugün" value={today.seconds >= 60 ? fmtDuration(today.seconds) : `${today.xp} XP`} />
        </dl>
      </div>
      <div className="mt-5">
        <Heatmap activity={s.activity} goal={s.settings.dailyGoalXp} now={now} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-xs text-muted">{label}</dt>
      <dd className="order-1 text-[15px] font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function HowItWorks({ className }: { className?: string }) {
  const steps = [
    {
      icon: '📖',
      title: 'Kısa ders, hemen dene',
      text: 'Her ders 10–20 dakika. Okuduğunu aynı ekranda kodla dener, sorularla kendini yoklarsın.',
    },
    {
      icon: '🗓️',
      title: 'Doğru zamanda tekrar',
      text: 'Öğrendiğin kartlar, tam unutmak üzereyken karşına çıkar. Böylece bilgi kalıcı olur.',
    },
    {
      icon: '🏆',
      title: 'Sınavla ustalaş',
      text: 'Her modülün sonunda karışık bir sınav var. %80 ile geçince modülü ustalaşırsın ve yol açılır.',
    },
  ];
  return (
    <section aria-labelledby="how-title" className={clsx('rounded-3xl border border-border bg-surface p-5 shadow-card', className)}>
      <SectionHeader id="how-title" title="Rusteach nasıl öğretir?" description="Bilimsel olarak işe yaradığı gösterilen üç alışkanlık." />
      <ol className="mt-4 grid gap-3 @xl:grid-cols-3">
        {steps.map((st, i) => (
          <li key={st.title} className="rounded-2xl bg-surface-2 p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {st.icon}
              </span>
              <span className="text-xs font-semibold text-subtle">{i + 1}. adım</span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-fg">{st.title}</h3>
            <p className="mt-1 text-[13px] leading-5 text-muted">{st.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ region

function CurrentRegion({ s, className }: { s: ProgressState; className?: string }) {
  const navigate = useNavigate();
  const tier = currentTier(s);
  if (!tier) return null;
  const ms = modulesOfTier(tier.id);
  const statuses = ms.map((m) => moduleStatus(s, m));
  const index = tiers.indexOf(tier) + 1;
  const locked = statuses.length > 0 && statuses.every((x) => x === 'locked');

  return (
    <RegionBanner tier={tier} index={index} statuses={statuses} locked={locked} id="region-title" className={clsx('shadow-card', className)}>
      {ms.length > 0 ? (
        <ol className="relative mt-5 grid gap-2 @xl:grid-cols-2 @5xl:grid-cols-3">
          {ms.map((m, i) => (
            <li key={m.id}>
              <Link
                to={`/modul/${m.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--tier)_18%,var(--c-border))] bg-[color-mix(in_oklab,var(--c-surface)_82%,transparent)] p-3 backdrop-blur-sm transition-colors hover:border-[color-mix(in_oklab,var(--tier)_45%,var(--c-border))]"
              >
                <ModuleGlyph m={m} status={statuses[i]} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{m.title}</span>
                  <span className="block text-xs text-muted">
                    Modül {m.number}: {STATUS_LABEL[statuses[i]]}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="relative mt-4 text-sm text-muted">Bu bölgenin modülleri hazırlanıyor.</p>
      )}
      <div className="relative mt-4 flex justify-end">
        <Button size="sm" variant="secondary" icon={<MapIcon className="size-4" />} onClick={() => navigate('/harita')}>
          Haritada gör
        </Button>
      </div>
    </RegionBanner>
  );
}

function ModuleGlyph({ m, status }: { m: Module; status: ReturnType<typeof moduleStatus> }) {
  return (
    <span
      className={clsx('relative grid size-10 shrink-0 place-items-center rounded-xl text-xl', status === 'locked' && 'grayscale')}
      style={{
        background: status === 'locked' ? 'var(--c-surface-2)' : 'color-mix(in oklab, var(--tier) 18%, var(--c-surface))',
        opacity: status === 'locked' ? 0.7 : 1,
      }}
      aria-hidden
    >
      {m.icon}
      {status === 'mastered' && (
        <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-gold text-[#2a1a00] shadow">
          <Crown className="size-3" strokeWidth={2.5} />
        </span>
      )}
      {status === 'completed' && (
        <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-success text-on-success shadow">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ stats + achievements

function QuickStats({ s, className }: { s: ProgressState; className?: string }) {
  const acc = firstTryAccuracy(s);
  const stats = [
    { label: 'Tamamlanan ders', value: fmtNum(completedLessonCount(s)), of: totals.lessons ? `/${fmtNum(totals.lessons)}` : '' },
    { label: 'Çözülen alıştırma', value: fmtNum(solvedExerciseCount(s)), of: totals.exercises ? `/${fmtNum(totals.exercises)}` : '' },
    { label: 'Kalıcı kart', value: fmtNum(learnedCardCount(s)), of: '' },
    { label: 'İlk denemede doğru', value: acc === null ? '–' : fmtPct(acc), of: '' },
  ];
  return (
    <section aria-labelledby="stats-title" className={clsx('flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-card', className)}>
      <SectionHeader
        id="stats-title"
        title="Şimdiye kadar"
        action={
          <Link to="/istatistik" className="rounded-md text-[13px] font-semibold text-accent hover:underline">
            Tüm istatistikler
          </Link>
        }
      />
      <dl className="mt-4 grid flex-1 grid-cols-2 gap-x-4 gap-y-5">
        {stats.map((st) => (
          <div key={st.label} className="flex flex-col">
            <dt className="order-2 mt-0.5 text-[13px] leading-5 text-muted">{st.label}</dt>
            <dd className="order-1 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg">
              {st.value}
              {st.of && <span className="text-sm font-medium text-subtle">{st.of}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {s.totalSeconds >= 60 && (
        <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-[13px] text-muted">
          <Clock className="size-4 text-subtle" aria-hidden />
          Toplam çalışma: <span className="font-semibold text-fg">{fmtDuration(s.totalSeconds)}</span>
        </p>
      )}
    </section>
  );
}

function Achievements({ s, className }: { s: ProgressState; className?: string }) {
  const recent = useMemo(
    () =>
      Object.entries(s.achievements)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([id, at]) => ({ def: getAchievement(id), at }))
        .filter((x): x is { def: NonNullable<typeof x.def>; at: string } => !!x.def)
        .slice(0, 3),
    [s.achievements],
  );
  const upcoming = useMemo(
    () =>
      ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && !a.secret && a.progress)
        .map((a) => {
          const p = a.progress!(s);
          return { def: a, ratio: p.value / Math.max(1, p.target) };
        })
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, Math.max(0, 3 - recent.length)),
    [s, recent.length],
  );

  return (
    <section aria-labelledby="ach-title" className={className}>
      <SectionHeader
        id="ach-title"
        title={recent.length ? 'Son başarımlar' : 'Sıradaki başarımlar'}
        action={
          <Link to="/profil#basarimlar" className="rounded-md text-[13px] font-semibold text-accent hover:underline">
            Tüm başarımlar
          </Link>
        }
      />
      <div className="mt-3 grid gap-3 @2xl:grid-cols-3">
        {recent.map(({ def, at }) => (
          <AchievementTile key={def.id} def={def} unlockedAt={at} state={s} />
        ))}
        {upcoming.map(({ def }) => (
          <AchievementTile key={def.id} def={def} state={s} />
        ))}
      </div>
    </section>
  );
}
