// Nothing due right now: celebrate, say when the next cards arrive, show the week ahead and offer
// useful next steps (new lesson, mixed practice, mistakes notebook, speed round, card browser).
import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CalendarClock, ChevronRight, Library, NotebookPen, Shuffle, Timer } from 'lucide-react';
import { nextLessonId, useProgress, type ProgressData } from '../../store/progress';
import { findBlock, findFlashcard, getLesson } from '../../lib/content';
import { completedLessons, openMistakeCount, speedRoundPool, SPEED_ROUND } from '../../lib/practice';
import { reviewForecast } from '../../lib/stats';
import { formatDue } from '../../lib/srs';
import Ferris from '../Ferris';
import { Button } from '../ui/Button';
import ForecastStrip from './ForecastStrip';
import SpacingCurve from './SpacingCurve';
import { SectionCard } from './shared/ui';

interface Suggestion {
  key: string;
  icon: ReactNode;
  title: string;
  text: string;
  to?: string;
  onClick?: () => void;
}

function activeEntries(s: ProgressData) {
  return Object.values(s.srs).filter((e) => !e.suspended && (e.kind === 'check' ? !!findBlock(e.id) : !!findFlashcard(e.id)));
}

function SuggestionRow({ s, index }: { s: Suggestion; index: number }) {
  const inner = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-accent">{s.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{s.title}</span>
        <span className="block truncate text-xs text-muted">{s.text}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  );
  const cls =
    'group flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 text-left outline-none transition-colors hover:border-border hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-accent';
  return (
    <motion.li initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + index * 0.05 }}>
      {s.to ? (
        <Link to={s.to} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={s.onClick} className={cls}>
          {inner}
        </button>
      )}
    </motion.li>
  );
}

export default function ReviewEmpty({ now, onBrowse }: { now: Date; onBrowse: () => void }) {
  const navigate = useNavigate();
  const state = useProgress();
  const data = useMemo(() => {
    const active = activeEntries(state);
    const learned = active.filter((e) => e.card.state !== 0);
    const nextCard = [...learned].sort((a, b) => a.card.due.localeCompare(b.card.due))[0];
    const waitingNew = active.length - learned.length; // new cards held back by the daily limit
    const forecast = reviewForecast(state, 8, now);
    const nextLesson = getLesson(nextLessonId(state) ?? '');
    return {
      total: active.length,
      nextDue: nextCard ? formatDue(nextCard.card, now) : waitingNew > 0 ? 'Yarın' : null,
      laterToday: forecast[0]?.total ?? 0,
      week: forecast.slice(1),
      waitingNew,
      nextLesson,
      canPractice: completedLessons(state).length > 0,
      mistakes: openMistakeCount(state),
      speed: speedRoundPool(state, now).length >= SPEED_ROUND.minItems,
    };
  }, [state, now]);

  const weekTotal = data.week.reduce((n, d) => n + d.total, 0);
  const suggestions: Suggestion[] = [];
  if (data.nextLesson)
    suggestions.push({
      key: 'lesson',
      icon: <BookOpen className="size-[18px]" aria-hidden />,
      title: 'Yeni bir ders öğren',
      text: `${data.nextLesson.title}: bitirdiğinde yeni kartlar eklenir.`,
      to: `/ders/${data.nextLesson.id}`,
    });
  if (data.canPractice)
    suggestions.push({
      key: 'mixed',
      icon: <Shuffle className="size-[18px]" aria-hidden />,
      title: 'Karma antrenman',
      text: 'Zayıf noktalarına ağırlık veren karışık sorular.',
      to: '/antrenman',
    });
  if (data.mistakes > 0)
    suggestions.push({
      key: 'mistakes',
      icon: <NotebookPen className="size-[18px]" aria-hidden />,
      title: 'Hata defteri',
      text: `${data.mistakes} açık hatan var; doğru cevapladıkça defterden düşer.`,
      to: '/antrenman?sekme=hata',
    });
  if (data.speed)
    suggestions.push({
      key: 'speed',
      icon: <Timer className="size-[18px]" aria-hidden />,
      title: 'Hız turu',
      text: '3 dakikada 10 soru: bildiklerini hızlı hatırlamayı çalış.',
      to: '/antrenman?sekme=hiz',
    });
  if (data.total > 0)
    suggestions.push({
      key: 'browse',
      icon: <Library className="size-[18px]" aria-hidden />,
      title: 'Kartlarına göz at',
      text: `${data.total} kartın var; askıya aldıklarını buradan geri açabilirsin.`,
      onClick: onBrowse,
    });

  // Brand new learner: explain what this page will do once lessons are finished.
  if (data.total === 0) {
    return (
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-10 text-center" aria-labelledby="review-empty-title">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
          <div className="relative mx-auto flex max-w-md flex-col items-center">
            <Ferris mood="wave" size={132} />
            <h2 id="review-empty-title" className="mt-4 text-2xl font-semibold tracking-tight text-fg">
              Henüz tekrar kartın yok
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Bir dersi bitirdiğinde o dersin bilgi kartları buraya eklenir. Yanlış yaptığın sorular da unutmadan önce yeniden
              karşına çıkar.
            </p>
            {data.nextLesson && (
              <Button
                size="lg"
                className="mt-6"
                icon={<BookOpen className="size-4" />}
                onClick={() => navigate(`/ders/${data.nextLesson!.id}`)}
              >
                Derse başla
              </Button>
            )}
          </div>
        </section>
        <SectionCard
          title="Aralıklı tekrar nasıl çalışır?"
          description="Bir bilgiyi tam unutmak üzereyken hatırlamaya çalışmak, onu her seferinde daha uzun süre kalıcı yapar."
        >
          <SpacingCurve />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Rusteach her kart için ne zaman unutmaya başlayacağını hesaplar ve kartı tam o gün getirir. Sen yalnızca dürüstçe
            puanlarsın: zorlandıysan kart daha erken, kolay geldiyse daha geç gelir.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-10 text-center"
        aria-labelledby="review-empty-title"
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
        <div className="relative mx-auto flex max-w-md flex-col items-center">
          <Ferris mood="celebrate" size={140} />
          <h2 id="review-empty-title" className="mt-4 text-2xl font-semibold tracking-tight text-fg">
            Bugün tekrar edilecek kart yok 🎉
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Hafızan şimdilik güncel. Her kart, unutmaya başlayacağın zamana göre planlandı; zamanı gelince burada olacak.
          </p>
          {data.nextDue && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-sm text-muted">
              <CalendarClock className="size-4 text-accent" aria-hidden />
              Sıradaki kart: <span className="font-semibold text-fg">{data.nextDue}</span>
            </div>
          )}
          {data.laterToday > 0 && (
            <p className="mt-2 text-xs text-subtle">Bugün içinde {data.laterToday} kart daha gelecek; sayfayı açık bırakabilirsin.</p>
          )}
          {data.waitingNew > 0 && (
            <p className="mt-5 max-w-sm rounded-2xl border border-border bg-surface-2/70 px-4 py-3 text-xs leading-relaxed text-muted">
              Bugünkü yeni kart sınırına ulaştın ({state.settings.newCardsPerDay} kart). Bekleyen {data.waitingNew} yeni kart
              önümüzdeki günlere yayılacak.{' '}
              <Link to="/ayarlar" className="font-semibold text-accent underline-offset-2 hover:underline">
                Sınırı değiştir
              </Link>
            </p>
          )}
        </div>
      </motion.section>

      <div className="flex flex-col gap-5">
        <SectionCard
          title="Önümüzdeki 7 gün"
          description={weekTotal ? `Bu hafta ${weekTotal} tekrar planlandı.` : 'Bu hafta planlanmış tekrar yok.'}
        >
          <ForecastStrip days={data.week} />
        </SectionCard>
        {suggestions.length > 0 && (
          <SectionCard title="Şimdi ne yapabilirsin?">
            <ul className="-mx-2.5 -my-1 space-y-0.5">
              {suggestions.map((s, i) => (
                <SuggestionRow key={s.key} s={s} index={i} />
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
