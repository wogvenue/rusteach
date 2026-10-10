// End-of-lesson moment: rewards, first-try accuracy, new cards, an objectives self-check and a
// three-sentence summary (generation + metacognition), then where to go next.
import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BookOpen, Check, CircleCheck, Clock3, Layers, NotebookPen, Swords, Target, Zap } from 'lucide-react';
import type { Lesson, Module } from '../../types/content';
import { useProgress } from '../../store/progress';
import Ferris from '../Ferris';
import Html from '../blocks/Html';
import { Button } from '../ui/Button';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { formatMinutes, useFocusOnMount } from './hooks';

export interface NextStep {
  kind: 'lesson' | 'boss' | 'module';
  to: string;
  title: string;
}

const SUMMARY_PREFIX = 'Özetim: ';

function mergeSummary(note: string, summary: string): string {
  const rest = note.replace(/(^|\n\n)Özetim: [\s\S]*$/, '').trimEnd();
  return rest ? `${rest}\n\n${SUMMARY_PREFIX}${summary}` : `${SUMMARY_PREFIX}${summary}`;
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: ReactNode; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3.5">
      <div className={clsx('flex items-center gap-2 text-2xl font-bold tabular-nums tracking-tight', tone)}>
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export default function CompletionScreen({
  lesson,
  module,
  xp,
  accuracy,
  newCards,
  seconds,
  deferred,
  dueCount,
  next,
  onNavigate,
  onBack,
  repeat,
}: {
  lesson: Lesson;
  module?: Module;
  xp: number;
  accuracy: { correct: number; answered: number; ratio: number | null };
  newCards: number;
  seconds: number;
  deferred: number;
  dueCount: number;
  next?: NextStep;
  onNavigate: (to: string) => void;
  onBack: () => void;
  repeat: boolean;
}) {
  const [can, setCan] = useState<boolean[]>(() => lesson.objectives.map(() => false));
  const [summary, setSummary] = useState('');
  const primary = useFocusOnMount<HTMLButtonElement>();
  const [savedSummary, setSavedSummary] = useState(false);
  const pct = accuracy.ratio === null ? null : Math.round(accuracy.ratio * 100);
  const mood = pct === null || pct >= 60 ? 'celebrate' : 'happy';
  const unchecked = can.filter((c) => !c).length;
  const checkedAny = can.some(Boolean);

  const saveSummary = () => {
    const text = summary.trim();
    if (!text) return;
    const s = useProgress.getState();
    s.setNote(lesson.id, mergeSummary(s.notes[lesson.id] ?? '', text));
    setSavedSummary(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:pt-14"
      role="region"
      aria-labelledby="complete-title"
    >
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        >
          <Ferris mood={mood} size={150} />
        </motion.div>
        <h1 id="complete-title" className="mt-4 text-3xl font-bold tracking-[-0.025em] text-fg">
          {repeat ? 'Ders yeniden tamamlandı!' : 'Ders tamamlandı!'}
        </h1>
        <p className="mt-1.5 text-muted">{lesson.title}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 26 }}
        className="mt-8 grid grid-cols-3 gap-3"
      >
        <Stat
          icon={<Zap className="size-5 fill-current" />}
          value={
            <span>
              +<AnimatedNumber value={xp} />
            </span>
          }
          label="XP kazandın"
          tone="text-xp"
        />
        <Stat
          icon={<CircleCheck className="size-5" />}
          value={pct === null ? '–' : `%${pct}`}
          label={pct === null ? 'cevaplanan soru yok' : `ilk denemede doğru (${accuracy.correct}/${accuracy.answered})`}
          tone={pct === null ? 'text-muted' : pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'}
        />
        <Stat icon={<Layers className="size-5" />} value={newCards} label="yeni kart destende" tone="text-info" />
      </motion.div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle">
        <Clock3 className="size-3.5" /> Bu oturumda {formatMinutes(seconds)} odaklandın.
        {deferred > 0 && ` ${deferred} alıştırmayı sonraya bıraktın; Antrenman sayfasında seni bekliyor.`}
      </p>

      {lesson.objectives.length > 0 && (
        <section className="mt-9 rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="objectives-check">
          <h2 id="objectives-check" className="flex items-center gap-2 font-semibold text-fg">
            <Target className="size-4 text-accent" /> Kendini yokla: artık bunları yapabiliyor musun?
          </h2>
          <ul className="mt-3 space-y-2">
            {lesson.objectives.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={can[i]}
                  onClick={() => setCan((c) => c.map((x, j) => (j === i ? !x : x)))}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    can[i] ? 'border-success/40 bg-success/6' : 'border-border hover:bg-surface-2',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                      can[i] ? 'border-success bg-success text-on-success' : 'border-border-strong',
                    )}
                    aria-hidden="true"
                  >
                    {can[i] && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <Html as="span" html={o} prose={false} className="min-w-0 text-fg" />
                </button>
              </li>
            ))}
          </ul>
          {checkedAny && unchecked > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              İşaretlemediğin hedefler için “Derse geri dön” ile ilgili adıma göz at; tekrar kartların da bu konuları yakında
              yeniden soracak.
            </p>
          )}
        </section>
      )}

      <section className="mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="summary-title">
        <h2 id="summary-title" className="flex items-center gap-2 font-semibold text-fg">
          <NotebookPen className="size-4 text-accent" /> Bu dersi üç cümlede özetle
        </h2>
        <p className="mt-1 text-sm text-muted">Hafızadan, derse bakmadan yaz. Özetin ders notlarına eklenir.</p>
        <textarea
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setSavedSummary(false);
          }}
          rows={3}
          className="lesson-textarea mt-3"
          placeholder="1) … 2) … 3) …"
          aria-label="Ders özetin"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={saveSummary} disabled={!summary.trim() || savedSummary}>
            {savedSummary ? 'Notlarına eklendi' : 'Notlarıma ekle'}
          </Button>
          {savedSummary && <Check className="size-4 text-success" aria-hidden="true" />}
        </div>
      </section>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        {next && (
          <Button
            size="lg"
            onClick={() => onNavigate(next.to)}
            icon={next.kind === 'boss' ? <Swords className="size-5" /> : <BookOpen className="size-5" />}
            className="max-w-full"
            ref={primary}
          >
            <span className="min-w-0 truncate">
              {next.kind === 'boss' ? 'Modül sınavına geç' : next.kind === 'module' ? `Sonraki modül: ${next.title}` : `Sonraki ders: ${next.title}`}
            </span>
          </Button>
        )}
        {dueCount > 0 && (
          <Button size="lg" variant="secondary" icon={<Layers className="size-5" />} onClick={() => onNavigate('/tekrar')}>
            Şimdi tekrar et ({dueCount})
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {module && (
          <Button variant="ghost" onClick={() => onNavigate(`/modul/${module.id}`)}>
            Modüle dön
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          Derse geri dön
        </Button>
      </div>
    </motion.div>
  );
}
