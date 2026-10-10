// "Alıştırma kataloğu": every coding exercise of the lessons the learner has started, filterable by
// module, difficulty, status and text. An exercise opens in a large panel with the lesson player's
// exercise block (practice mode), with previous / next navigation inside the filtered list.
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, CircleDot, ExternalLink, Eye, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { nextLessonId, useProgress } from '../../../store/progress';
import { getLesson } from '../../../lib/content';
import {
  EXERCISE_STATUS_LABELS,
  exerciseCatalog,
  filterCatalog,
  htmlToText,
  type CatalogEntry,
  type ExerciseStatus,
} from '../../../lib/practice';
import { celebrateSmall } from '../../../lib/celebrate';
import BlockRenderer from '../../blocks/BlockRenderer';
import type { BlockOutcome } from '../../blocks/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ProgressBar } from '../../ui/primitives';
import { Segmented } from '../../ui/Segmented';
import { DifficultyMeter, EmptyState, FilterChip, ModuleTag, SearchField, SelectField } from '../shared/ui';
import { useStudyClock } from '../shared/hooks';

type StatusFilter = 'all' | 'unsolved' | 'solved';

const STATUS_STYLE: Record<ExerciseStatus, { className: string; icon: typeof Circle }> = {
  new: { className: 'bg-surface-2 text-muted', icon: Circle },
  tried: { className: 'bg-warning-soft text-warning', icon: CircleDot },
  revealed: { className: 'bg-info-soft text-info', icon: Eye },
  solved: { className: 'bg-success-soft text-success', icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: ExerciseStatus }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', s.className)}>
      <Icon className="size-3.5" aria-hidden />
      {EXERCISE_STATUS_LABELS[status]}
    </span>
  );
}

function ExerciseCard({ entry, onOpen, index }: { entry: CatalogEntry; onOpen: () => void; index: number }) {
  const { block, module, lesson, status, progress } = entry;
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.025 }}>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col rounded-3xl border border-border bg-surface p-4 text-left outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span className="flex items-center justify-between gap-2">
          <ModuleTag module={module} compact />
          <DifficultyMeter value={block.difficulty} />
        </span>
        <span className="mt-3 block text-[15px] font-semibold leading-snug text-fg">{block.title}</span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{htmlToText(block.prompt)}</span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-4">
          <StatusBadge status={status} />
          <span className="truncate text-xs text-subtle">
            {progress?.attempts ? `${progress.attempts} deneme` : lesson.title}
          </span>
        </span>
      </button>
    </motion.li>
  );
}

function ExercisePanel({
  entry,
  position,
  onPrev,
  onNext,
}: {
  entry: CatalogEntry;
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<'solved' | 'revealed' | null>(null);
  const progress = useProgress((s) => s.exercises[entry.block.id]);
  useStudyClock(true);

  const onComplete = (o: BlockOutcome) => {
    if (o.correct) {
      setResult('solved');
      celebrateSmall();
    } else setResult('revealed');
  };
  const restart = () => {
    setResult(null);
    setAttempt((a) => a + 1);
  };

  return (
    <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 pb-4 pt-5 pr-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ModuleTag module={entry.module} />
            <Link
              to={`/ders/${entry.lesson.id}`}
              className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ExternalLink className="size-3" aria-hidden /> {entry.lesson.title}
            </Link>
          </div>
          <h2 id="exercise-dialog-title" className="mt-2 text-xl font-semibold tracking-tight text-fg">
            {entry.block.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <StatusBadge status={progress ? (progress.usedSolution ? 'revealed' : progress.solved ? 'solved' : progress.attempts ? 'tried' : 'new') : 'new'} />
            {!!progress?.attempts && <span>{progress.attempts} kontrol</span>}
            {!!progress?.hintsUsed && <span>{progress.hintsUsed} ipucu</span>}
            {position && (
              <span className="lx-tabular" aria-label={`Listede ${position.total} alıştırmadan ${position.index + 1}. sırada`}>
                {position.index + 1}/{position.total}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <BlockRenderer key={`${entry.block.id}-${attempt}`} block={entry.block} lessonId={entry.lesson.id} mode="practice" fresh onComplete={onComplete} />
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={clsx(
              'mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3',
              result === 'solved' ? 'border-success/30 bg-success-soft' : 'border-info/30 bg-info-soft',
            )}
          >
            <div className="flex items-center gap-3">
              {result === 'solved' ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Eye className="size-5 text-info" aria-hidden />}
              <div>
                <div className="text-sm font-semibold text-fg">{result === 'solved' ? 'Çözdün!' : 'Çözümü inceledin'}</div>
                <div className="text-xs text-muted">
                  {result === 'solved'
                    ? 'Kendi başına yazdığın kod, okuduğun koddan çok daha iyi hatırlanır.'
                    : 'Bir gün sonra bu alıştırmayı çözüme bakmadan baştan yazmayı dene.'}
                </div>
              </div>
            </div>
            {onNext && (
              <Button iconRight={<ArrowRight className="size-4" />} onClick={onNext}>
                Sıradaki alıştırma
              </Button>
            )}
          </motion.div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={onPrev} disabled={!onPrev}>
            Önceki
          </Button>
          <Button variant="ghost" size="sm" iconRight={<ArrowRight className="size-4" />} onClick={onNext} disabled={!onNext}>
            Sonraki
          </Button>
        </div>
        <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={restart}>
          Baştan başla
        </Button>
      </footer>
    </div>
  );
}

export default function ExerciseCatalog({ initialModule }: { initialModule?: string }) {
  const navigate = useNavigate();
  const exercises = useProgress((s) => s.exercises);
  const lessons = useProgress((s) => s.lessons);
  // Depends on lesson progress (which lessons are started) and exercise progress.
  const entries = useMemo(() => exerciseCatalog(useProgress.getState()), [exercises, lessons]);

  const [query, setQuery] = useState('');
  const [moduleId, setModuleId] = useState(() => (initialModule && entries.some((e) => e.module.id === initialModule) ? initialModule : 'all'));
  const [difficulties, setDifficulties] = useState<number[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () => filterCatalog(entries, { moduleId: moduleId === 'all' ? undefined : moduleId, difficulties, status, query: deferredQuery }),
    [entries, moduleId, difficulties, status, deferredQuery],
  );
  const moduleOptions = useMemo(() => {
    const seen = new Map<string, CatalogEntry['module']>();
    for (const e of entries) seen.set(e.module.id, e.module);
    return [{ value: 'all', label: 'Tüm modüller' }, ...[...seen.values()].map((m) => ({ value: m.id, label: `${m.icon} ${m.title}` }))];
  }, [entries]);

  const solved = entries.filter((e) => e.status === 'solved').length;
  const openIndex = openId ? filtered.findIndex((e) => e.block.id === openId) : -1;
  // Keep the panel open even if the opened exercise drops out of the filter (e.g. it just got solved
  // under "Çözülmemiş"); navigation then continues from the position it had.
  const openEntry = openIndex >= 0 ? filtered[openIndex] : openId ? entries.find((e) => e.block.id === openId) : undefined;
  const [lastIndex, setLastIndex] = useState(0);
  useEffect(() => {
    if (openIndex >= 0) setLastIndex(openIndex);
  }, [openIndex]);
  const prevIndex = (openIndex >= 0 ? openIndex : lastIndex) - 1;
  const nextIndex = openIndex >= 0 ? openIndex + 1 : lastIndex;
  const prevEntry = prevIndex >= 0 ? filtered[prevIndex] : undefined;
  const nextEntry = filtered[nextIndex];

  if (!entries.length) {
    const next = getLesson(nextLessonId(useProgress.getState()) ?? '');
    return (
      <EmptyState
        mood="thinking"
        title="Alıştırmalar ders ilerledikçe açılır"
        actions={
          next && (
            <Button icon={<BookOpen className="size-4" />} onClick={() => navigate(`/ders/${next.id}`)}>
              Derse başla
            </Button>
          )
        }
      >
        Başladığın derslerin kodlama alıştırmaları burada toplanır. Onları istediğin zaman yeniden çözebilir, çözüme bakmadan
        yazmayı deneyebilirsin.
      </EmptyState>
    );
  }

  const toggleDifficulty = (d: number) => setDifficulties((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));
  const hasFilters = !!query || moduleId !== 'all' || difficulties.length > 0 || status !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4">
        <div className="grid gap-2.5 @3xl:grid-cols-[minmax(0,1fr)_240px]">
          <SearchField value={query} onChange={setQuery} placeholder="Alıştırmalarda ara…" label="Alıştırmalarda ara" />
          <SelectField value={moduleId} onChange={setModuleId} options={moduleOptions} label="Modül" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Zorluk">
            <span className="mr-1 text-xs font-semibold text-muted">Zorluk</span>
            {[1, 2, 3, 4, 5].map((d) => (
              <FilterChip key={d} active={difficulties.includes(d)} onClick={() => toggleDifficulty(d)} title={`Zorluk ${d}/5`}>
                <DifficultyMeter value={d} />
                <span className="lx-tabular">{d}</span>
              </FilterChip>
            ))}
          </div>
          <Segmented<StatusFilter>
            label="Durum"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'unsolved', label: 'Çözülmemiş' },
              { value: 'solved', label: 'Çözülmüş' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-1">
        <div className="min-w-48 flex-1">
          <ProgressBar value={entries.length ? solved / entries.length : 0} height={6} label="Çözülen alıştırmalar" color="var(--c-success)" />
        </div>
        <p className="text-sm text-muted">
          <span className="font-semibold text-fg lx-tabular">
            {solved}/{entries.length}
          </span>{' '}
          alıştırma çözüldü
          {hasFilters && <span className="text-subtle">, filtrede {filtered.length}</span>}
        </p>
      </div>

      {filtered.length ? (
        <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {filtered.map((e, i) => (
            <ExerciseCard key={e.block.id} entry={e} index={i} onOpen={() => setOpenId(e.block.id)} />
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="text-sm font-medium text-fg">Bu filtrelere uyan alıştırma yok.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery('');
              setModuleId('all');
              setDifficulties([]);
              setStatus('all');
            }}
          >
            Filtreleri temizle
          </Button>
        </div>
      )}

      <Dialog open={!!openEntry} onClose={() => setOpenId(null)} labelledBy="exercise-dialog-title" className="max-w-[1080px]! overflow-hidden">
        {openEntry && (
          <ExercisePanel
            key={openEntry.block.id}
            entry={openEntry}
            position={openIndex >= 0 ? { index: openIndex, total: filtered.length } : undefined}
            onPrev={prevEntry ? () => setOpenId(prevEntry.block.id) : undefined}
            onNext={nextEntry ? () => setOpenId(nextEntry.block.id) : undefined}
          />
        )}
      </Dialog>
    </div>
  );
}
