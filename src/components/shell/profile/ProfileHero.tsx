// Profile hero: Ferris avatar inside the level ring, editable name, level + title, XP to the next
// level and the learner's lifetime totals.
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { BookOpen, Check, Clock, Code2, Crown, Flame, Layers, Pencil, Sparkles, X } from 'lucide-react';
import Ferris from '../../Ferris';
import { ProgressRing } from '../../ui/primitives';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { levelInfo } from '../../../lib/xp';
import { modules } from '../../../lib/content';
import { useProgress, type ProgressData } from '../../../store/progress';
import { completedLessonCount, effectiveStreak, journeyComplete, learnedCardCount, masteredModules, solvedExerciseCount } from '../stats';
import { fmtDate, fmtDuration, fmtNum } from '../turkish';

export default function ProfileHero({ s }: { s: ProgressData }) {
  const info = levelInfo(s.xp);
  const toNext = info.needed - info.current;
  const done = journeyComplete(s);

  return (
    <section aria-labelledby="profile-name" className="glow-mesh relative isolate overflow-hidden rounded-3xl border border-border p-6 shadow-card lg:p-8">
      <div className="flex flex-col gap-6 @3xl:flex-row @3xl:items-center">
        <div className="relative shrink-0 self-start @3xl:self-center">
          <ProgressRing value={info.progress} size={148} stroke={8} color="var(--c-xp)" label={`Seviye ${info.level} ilerlemesi`}>
            <span className="grid size-[118px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,var(--c-accent)_22%,var(--c-surface-2)),var(--c-surface-2))]">
              <Ferris size={92} mood={done ? 'celebrate' : 'happy'} />
            </span>
          </ProgressRing>
          <span className="absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-surface bg-xp px-2.5 py-0.5 text-[13px] font-bold text-[#1f1600] shadow">
            Seviye {info.level}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <NameEditor name={s.profile.name} />
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
              <span aria-hidden>{info.emoji}</span>
              {info.title}
            </span>
            <span aria-hidden className="text-subtle">
              /
            </span>
            <span>{fmtDate(s.profile.createdAt)} tarihinden beri öğreniyor</span>
          </p>

          <div className="mt-5 max-w-[460px]">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold text-fg">
                <AnimatedNumber value={s.xp} className="tabular-nums" /> XP
              </span>
              <span className="text-muted">
                Seviye {info.level + 1} için <span className="font-semibold tabular-nums text-fg">{fmtNum(toNext)}</span> XP
              </span>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c-fg)_9%,transparent)]"
              role="progressbar"
              aria-label="Sonraki seviyeye ilerleme"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(info.progress * 100)}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--c-xp),var(--c-accent))] transition-[width] duration-700"
                style={{ width: `${info.progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        <Total icon={<Flame className="size-4 text-streak" />} label="Güncel seri" value={`${fmtNum(effectiveStreak(s))} gün`} />
        <Total icon={<Sparkles className="size-4 text-streak" />} label="En uzun seri" value={`${fmtNum(s.streak.best)} gün`} />
        <Total icon={<BookOpen className="size-4 text-info" />} label="Biten ders" value={fmtNum(completedLessonCount(s))} />
        <Total icon={<Code2 className="size-4 text-success" />} label="Çözülen alıştırma" value={fmtNum(solvedExerciseCount(s))} />
        <Total icon={<Crown className="size-4 text-gold" />} label="Ustalaşılan modül" value={`${fmtNum(masteredModules(s).length)}/${fmtNum(modules.length)}`} />
        <Total icon={<Layers className="size-4 text-accent" />} label="Öğrenilen kart" value={fmtNum(learnedCardCount(s))} />
        <Total icon={<Clock className="size-4 text-muted" />} label="Çalışma süresi" value={fmtDuration(s.totalSeconds)} className="col-span-2" />
      </dl>
    </section>
  );
}

function Total({ icon, label, value, className }: { icon: ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-2xl${className ? ` ${className}` : ''} border border-border bg-[color-mix(in_oklab,var(--c-surface)_75%,transparent)] px-3.5 py-3 backdrop-blur-sm`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-[19px] font-semibold tabular-nums tracking-[-0.02em] text-fg">{value}</dd>
    </div>
  );
}

function NameEditor({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const editBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(name);
    setEditing(true);
  };
  const finish = (save: boolean) => {
    if (save) useProgress.getState().updateProfile({ name: draft.trim().slice(0, 40) });
    setEditing(false);
    window.setTimeout(() => editBtn.current?.focus(), 0);
  };

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <label htmlFor="profile-name-input" className="sr-only">
          Adın
        </label>
        <input
          id="profile-name-input"
          ref={input}
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              finish(false);
            }
          }}
          placeholder="Adın"
          className="h-12 min-w-0 max-w-[360px] flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-[24px] font-semibold tracking-[-0.025em] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-[color-mix(in_oklab,var(--c-accent)_30%,transparent)]"
        />
        <IconButton label="Adı kaydet" type="submit" className="bg-accent text-accent-fg hover:bg-accent-strong">
          <Check className="size-5" strokeWidth={2.6} />
        </IconButton>
        <IconButton label="Vazgeç" onClick={() => finish(false)}>
          <X className="size-5" />
        </IconButton>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 id="profile-name" className="truncate text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg">
        {name.trim() || 'Rustacean'}
      </h1>
      <IconButton ref={editBtn} label="Adını düzenle" onClick={start}>
        <Pencil className="size-4" />
      </IconButton>
    </div>
  );
}


const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; onClick?: () => void; type?: 'button' | 'submit'; className?: string; children: ReactNode }
>(function IconButton({ label, onClick, type = 'button', className, children }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'grid size-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
});
