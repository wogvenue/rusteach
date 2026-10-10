// "Kart tarayıcı": every spaced-repetition card with search, module / state / type filters, memory
// strength (retrievability), next due date, details on demand and suspend / unsuspend.
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, CircleHelp, ExternalLink, PauseCircle, PlayCircle, SquareStack } from 'lucide-react';
import clsx from 'clsx';
import { dayKey, useProgress, type SrsEntry } from '../../store/progress';
import { findBlock, findFlashcard, getLesson, getModule, modules } from '../../lib/content';
import { blockPreview, normalizeSearch, srsEntryText } from '../../lib/practice';
import { cardStage, formatDue, retrievability, STAGE_LABELS, type CardStage } from '../../lib/srs';
import { formatNumber, formatPercent, shortDate } from '../../lib/stats';
import type { Module } from '../../types/content';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Tooltip } from '../ui/Tooltip';
import StageBadge from './StageBadge';
import { EmptyState, ModuleTag, Prose, SearchField, SelectField } from './shared/ui';
import CodeView from '../editor/CodeView';

type StageFilter = 'all' | 'new' | 'learning' | 'review' | 'suspended';
type KindFilter = 'all' | 'flashcard' | 'check';
type SortKey = 'due' | 'weak' | 'recent' | 'course';

const PAGE = 40;

interface Row {
  entry: SrsEntry;
  module?: Module;
  lessonTitle: string;
  front: string;
  frontHtml?: string;
  backHtml?: string;
  code?: string;
  stage: CardStage;
  R: number | null;
  due: number;
  order: number;
  search: string;
}

function buildRows(srs: Record<string, SrsEntry>, now: Date): Row[] {
  const rows: Row[] = [];
  for (const entry of Object.values(srs)) {
    const fc = entry.kind === 'flashcard' ? findFlashcard(entry.id) : undefined;
    const loc = entry.kind === 'check' ? findBlock(entry.id) : undefined;
    if (!fc && !loc) continue; // content removed since the card was added
    const module = getModule(entry.moduleId);
    const lesson = getLesson(entry.lessonId);
    const text = srsEntryText(entry);
    const preview = loc ? blockPreview(loc.block) : undefined;
    const stage = cardStage(entry.card);
    rows.push({
      entry,
      module,
      lessonTitle: lesson?.title ?? '',
      front: preview ? preview.text : text.front,
      frontHtml: fc?.card.front,
      backHtml: fc?.card.back,
      code: preview?.code,
      stage,
      R: stage === 'new' ? null : retrievability(entry.card, now),
      due: Date.parse(entry.card.due),
      order: (module?.order ?? 0) * 10_000 + (lesson?.index ?? 0) * 100,
      search: normalizeSearch(`${text.front} ${text.back ?? ''} ${lesson?.title ?? ''} ${module?.title ?? ''}`),
    });
  }
  return rows;
}

function matchesStage(r: Row, f: StageFilter): boolean {
  if (f === 'all') return true;
  if (f === 'suspended') return !!r.entry.suspended;
  if (r.entry.suspended) return false;
  if (f === 'learning') return r.stage === 'learning' || r.stage === 'relearning';
  return r.stage === f;
}

const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  due: (a, b) => Number(!!a.entry.suspended) - Number(!!b.entry.suspended) || a.due - b.due,
  weak: (a, b) => (a.R ?? 2) - (b.R ?? 2) || a.due - b.due,
  recent: (a, b) => b.entry.addedAt.localeCompare(a.entry.addedAt),
  course: (a, b) => a.order - b.order || a.entry.addedAt.localeCompare(b.entry.addedAt),
};

function memoryTone(R: number): string {
  if (R >= 0.9) return 'var(--c-success)';
  if (R >= 0.7) return 'var(--c-warning)';
  return 'var(--c-danger)';
}

function dateLabel(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return shortDate(dayKey(d));
}

function MemoryCell({ R }: { R: number | null }) {
  if (R === null) return <span className="text-xs text-subtle">Henüz çalışılmadı</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, R * 100)}%`, background: memoryTone(R) }} />
      </span>
      <span className="text-xs font-semibold text-fg lx-tabular">{formatPercent(R)}</span>
    </span>
  );
}

function Detail({ row }: { row: Row }) {
  const c = row.entry.card;
  const facts: [string, string][] = [
    ['Tekrar sayısı', formatNumber(c.reps)],
    ['Unutma', formatNumber(c.lapses)],
    ['Kararlılık', row.stage === 'new' ? '—' : `${c.stability < 1 ? '<1' : formatNumber(c.stability)} gün`],
    ['Zorluk', row.stage === 'new' ? '—' : `${c.difficulty.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}/10`],
    ['Eklendi', dateLabel(row.entry.addedAt)],
    ['Son tekrar', dateLabel(c.last_review)],
    ['Planlanan', row.entry.suspended ? 'Askıda' : dateLabel(c.due)],
  ];
  return (
    <div className="grid gap-4 px-4 pb-4 pt-1 @3xl:grid-cols-[minmax(0,1fr)_260px] sm:px-5">
      <div className="min-w-0 space-y-3">
        {row.frontHtml ? (
          <div className="grid gap-3 @2xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-2/60 p-3.5">
              <div className="mb-1.5 text-xs font-semibold text-muted">Ön yüz</div>
              <Prose html={row.frontHtml} className="text-sm text-fg" />
            </div>
            <div className="rounded-2xl border border-border bg-surface-2/60 p-3.5">
              <div className="mb-1.5 text-xs font-semibold text-muted">Arka yüz</div>
              <Prose html={row.backHtml ?? ''} className="text-sm text-fg" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface-2/60 p-3.5">
            <div className="mb-1.5 text-xs font-semibold text-muted">Soru</div>
            <p className="text-sm text-fg">{row.front}</p>
            {row.code && <CodeView code={row.code} lineNumbers={false} fontSize={12.5} className="mt-2" />}
          </div>
        )}
        <Link
          to={`/ders/${row.entry.lessonId}`}
          className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Derste gör: {row.lessonTitle}
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 self-start rounded-2xl border border-border p-3.5 text-xs">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-subtle">{k}</dt>
            <dd className="mt-0.5 font-semibold text-fg lx-tabular">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CardRow({ row, open, onToggle, now }: { row: Row; open: boolean; onToggle: () => void; now: Date }) {
  const suspended = !!row.entry.suspended;
  const dueText = suspended ? 'Askıda' : formatDue(row.entry.card, now);
  const overdue = !suspended && row.due <= now.getTime();
  const panelId = `card-detail-${row.entry.id}`;
  const toggleSuspend = () => useProgress.getState().suspendCard(row.entry.id, !suspended);
  return (
    <li className={clsx('transition-colors', open && 'bg-surface-2/40')}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 @3xl:grid-cols-[minmax(0,1fr)_128px_132px_118px_auto] sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group col-span-1 flex min-w-0 items-center gap-3 rounded-xl py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-xl border border-border',
              row.entry.kind === 'flashcard' ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info',
              suspended && 'opacity-50',
            )}
            title={row.entry.kind === 'flashcard' ? 'Bilgi kartı' : 'Soru'}
          >
            {row.entry.kind === 'flashcard' ? <SquareStack className="size-4" aria-hidden /> : <CircleHelp className="size-4" aria-hidden />}
            <span className="sr-only">{row.entry.kind === 'flashcard' ? 'Bilgi kartı' : 'Soru'}:</span>
          </span>
          <span className={clsx('min-w-0 flex-1', suspended && 'opacity-60')}>
            <span className="line-clamp-2 text-sm font-medium text-fg">{row.front || 'Adsız kart'}</span>
            <span className="mt-1 flex min-w-0 items-center gap-2">
              {row.module && <ModuleTag module={row.module} compact className="shrink-0" />}
              <span className="truncate text-xs text-subtle">{row.lessonTitle}</span>
            </span>
          </span>
          <ChevronDown className={clsx('size-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
        </button>

        <div className="order-last col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-12 @3xl:order-none @3xl:col-span-3 @3xl:grid @3xl:grid-cols-[128px_132px_118px] @3xl:gap-x-3 @3xl:pl-0">
          <span>
            <span className="sr-only">Durum: </span>
            {suspended ? (
              <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">Askıda</span>
            ) : (
              <StageBadge stage={row.stage} />
            )}
          </span>
          <span>
            <span className="sr-only">Hafıza: </span>
            <MemoryCell R={row.R} />
          </span>
          <span className={clsx('text-xs font-medium', overdue ? 'text-accent' : 'text-muted')}>
            <span className="sr-only">Sıradaki tekrar: </span>
            {dueText}
          </span>
        </div>

        <Tooltip content={suspended ? 'Kartı yeniden aç' : 'Kartı askıya al'} side="left">
          <button
            type="button"
            onClick={toggleSuspend}
            aria-label={suspended ? 'Kartı yeniden aç' : 'Kartı askıya al'}
            className={clsx(
              'grid size-9 place-items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
              suspended ? 'text-accent hover:bg-accent-soft' : 'text-subtle hover:bg-surface-2 hover:text-fg',
            )}
          >
            {suspended ? <PlayCircle className="size-[18px]" aria-hidden /> : <PauseCircle className="size-[18px]" aria-hidden />}
          </button>
        </Tooltip>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <Detail row={row} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function CardBrowser({ now }: { now: Date }) {
  const srs = useProgress((s) => s.srs);
  const rows = useMemo(() => buildRows(srs, now), [srs, now]);

  const [query, setQuery] = useState('');
  const [moduleId, setModuleId] = useState('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [stage, setStage] = useState<StageFilter>('all');
  const [sort, setSort] = useState<SortKey>('due');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const q = normalizeSearch(useDeferredValue(query));

  const base = useMemo(
    () =>
      rows.filter(
        (r) => (moduleId === 'all' || r.entry.moduleId === moduleId) && (kind === 'all' || r.entry.kind === kind) && (!q || r.search.includes(q)),
      ),
    [rows, moduleId, kind, q],
  );
  const counts = useMemo(() => {
    const c: Record<StageFilter, number> = { all: base.length, new: 0, learning: 0, review: 0, suspended: 0 };
    for (const r of base) for (const f of ['new', 'learning', 'review', 'suspended'] as const) if (matchesStage(r, f)) c[f]++;
    return c;
  }, [base]);
  const filtered = useMemo(() => base.filter((r) => matchesStage(r, stage)).sort(SORTERS[sort]), [base, stage, sort]);
  const visible = filtered.slice(0, limit);

  const moduleOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.entry.moduleId));
    return [
      { value: 'all', label: 'Tüm modüller' },
      ...modules.filter((m) => present.has(m.id)).map((m) => ({ value: m.id, label: `${m.icon} ${m.title}` })),
    ];
  }, [rows]);

  const resetPaging = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(PAGE);
  };
  const clearFilters = () => {
    setQuery('');
    setModuleId('all');
    setKind('all');
    setStage('all');
    setLimit(PAGE);
  };

  if (!rows.length) {
    return (
      <EmptyState mood="wave" title="Henüz kartın yok">
        Bir dersi bitirdiğinde bilgi kartları, yanlış yaptığın sorular da tekrar kartı olarak burada listelenir.
      </EmptyState>
    );
  }

  const stageLabel = (f: StageFilter, text: string) => (
    <>
      {text}
      <span className="text-[11px] font-semibold text-subtle lx-tabular">{counts[f]}</span>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
        <div className="grid gap-2.5 @3xl:grid-cols-[minmax(0,1fr)_220px_150px_170px]">
          <SearchField value={query} onChange={resetPaging(setQuery)} placeholder="Kartlarda ara…" label="Kartlarda ara" />
          <SelectField value={moduleId} onChange={resetPaging(setModuleId)} options={moduleOptions} label="Modül" />
          <SelectField
            value={kind}
            onChange={(v) => resetPaging(setKind)(v as KindFilter)}
            label="Kart türü"
            options={[
              { value: 'all', label: 'Tüm türler' },
              { value: 'flashcard', label: 'Bilgi kartları' },
              { value: 'check', label: 'Sorular' },
            ]}
          />
          <SelectField
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            label="Sıralama"
            options={[
              { value: 'due', label: 'Sıradaki önce' },
              { value: 'weak', label: 'En zayıf önce' },
              { value: 'recent', label: 'Son eklenen önce' },
              { value: 'course', label: 'Ders sırasıyla' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Kart durumu"
            size="sm"
            value={stage}
            onChange={resetPaging(setStage)}
            options={[
              { value: 'all', label: stageLabel('all', 'Tümü') },
              { value: 'new', label: stageLabel('new', STAGE_LABELS.new), hint: 'Henüz hiç tekrar edilmedi' },
              { value: 'learning', label: stageLabel('learning', STAGE_LABELS.learning), hint: 'İlk günlerinde ya da unutulup yeniden öğreniliyor' },
              { value: 'review', label: stageLabel('review', STAGE_LABELS.review), hint: 'Günler, haftalar arayla tekrar ediliyor' },
              { value: 'suspended', label: stageLabel('suspended', 'Askıda'), hint: 'Tekrarlara gelmiyor' },
            ]}
          />
          <p className="text-xs text-muted" aria-live="polite">
            {filtered.length === rows.length ? `${formatNumber(rows.length)} kart` : `${formatNumber(rows.length)} karttan ${formatNumber(filtered.length)} tanesi`}
          </p>
        </div>
      </div>

      {filtered.length ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          <div
            className="hidden grid-cols-[minmax(0,1fr)_128px_132px_118px_36px] gap-x-3 border-b border-border px-4 py-2.5 text-xs font-semibold text-subtle @3xl:grid"
            aria-hidden
          >
            <span className="pl-12">Kart</span>
            <span>Durum</span>
            <span>Hafıza</span>
            <span>Sıradaki</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {visible.map((row) => (
              <CardRow
                key={row.entry.id}
                row={row}
                now={now}
                open={open === row.entry.id}
                onToggle={() => setOpen((o) => (o === row.entry.id ? null : row.entry.id))}
              />
            ))}
          </ul>
          {filtered.length > visible.length && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Daha fazla göster ({formatNumber(filtered.length - visible.length)} kart kaldı)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="text-sm font-medium text-fg">Bu filtrelere uyan kart yok.</p>
          <p className="mt-1 text-xs text-muted">Aramayı kısaltmayı ya da başka bir modül seçmeyi dene.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
            Filtreleri temizle
          </Button>
        </div>
      )}
    </div>
  );
}
