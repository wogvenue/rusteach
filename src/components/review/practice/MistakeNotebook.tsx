// "Hata defteri": every question answered wrong, grouped by module and lesson. The learner writes
// why they slipped ("Neden yanıldım?"), retries in place (a first-try correct answer closes the
// entry) or works through all of them in an interleaved run.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ExternalLink, Lightbulb, ListRestart, RotateCcw, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useProgress, type MistakeEntry } from '../../../store/progress';
import { findBlock } from '../../../lib/content';
import { blockPreview, mistakeGroups, mistakeSession, openMistakeCount, type PracticeItem } from '../../../lib/practice';
import { relativeDayLabel } from '../../../lib/stats';
import { celebrateSmall } from '../../../lib/celebrate';
import { toast } from '../../../store/ui';
import type { BlockOutcome } from '../../blocks/types';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import ItemSheet from '../ItemSheet';
import { EmptyState, ModuleTag } from '../shared/ui';
import PracticeRunner from './PracticeRunner';
import CodeView from '../../editor/CodeView';

type View = 'open' | 'resolved';

/** The learner's "Neden yanıldım?" note — saved while typing (debounced) and on blur. */
function NoteField({ blockId, initial }: { blockId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const latest = useRef(initial);
  const savedValue = useRef(initial);
  const timer = useRef<number | undefined>(undefined);
  const id = `note-${blockId}`;

  const save = () => {
    window.clearTimeout(timer.current);
    if (latest.current === savedValue.current) return;
    useProgress.getState().setMistakeNote(blockId, latest.current.trim() ? latest.current : '');
    savedValue.current = latest.current;
    setStatus('saved');
  };

  useEffect(
    () => () => {
      // flush a pending note when the card disappears
      window.clearTimeout(timer.current);
      if (latest.current !== savedValue.current) useProgress.getState().setMistakeNote(blockId, latest.current);
    },
    [blockId],
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-fg">
          Neden yanıldım?
        </label>
        <span className="text-[11px] text-subtle" aria-live="polite">
          {status === 'pending' ? 'Yazılıyor…' : status === 'saved' ? 'Kaydedildi' : 'Bir cümle yeter'}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        rows={2}
        onChange={(e) => {
          setValue(e.target.value);
          latest.current = e.target.value;
          setStatus('pending');
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(save, 700);
        }}
        onBlur={save}
        placeholder="Örn. Değer taşındıktan sonra eski değişkeni hâlâ kullanabileceğimi sandım."
        className="block w-full resize-y rounded-xl border border-border bg-surface-2/70 px-3 py-2 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    </div>
  );
}

function MistakeCard({ entry, onResolved }: { entry: MistakeEntry; onResolved: (id: string) => void }) {
  const loc = findBlock(entry.blockId);
  const live = useProgress((s) => s.mistakes[entry.blockId]);
  const block = useProgress((s) => s.blocks[entry.blockId]);
  const [retry, setRetry] = useState<{ key: number; result: 'correct' | 'wrong' | null } | null>(null);
  if (!loc) return null;
  const preview = blockPreview(loc.block);
  const resolved = !!live?.resolved;
  const confidentError = block && !block.firstTry && block.confidence === 3;

  const onOutcome = (o: BlockOutcome) => {
    if (o.correct) {
      useProgress.getState().resolveMistake(entry.blockId);
      onResolved(entry.blockId);
      celebrateSmall();
      toast({ kind: 'success', title: 'Hata defterinden çıktı', description: 'İlk denemede doğru cevapladın.' });
      setRetry((r) => (r ? { ...r, result: 'correct' } : r));
    } else {
      setRetry((r) => (r ? { ...r, result: 'wrong' } : r));
    }
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={clsx('rounded-2xl border bg-surface p-4 transition-colors', resolved ? 'border-success/30' : 'border-border')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{preview.label}</span>
        <span className="text-xs font-medium text-danger">{(live?.count ?? entry.count) > 1 ? `${live?.count ?? entry.count} kez yanlış` : '1 kez yanlış'}</span>
        <span className="text-xs text-subtle">Son hata: {relativeDayLabel(live?.lastAt ?? entry.lastAt)}</span>
        {confidentError && (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning" title="Çok emin olduğun hâlde yanıldın">
            Emindin
          </span>
        )}
        {resolved && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Çözüldü{live?.resolvedAt ? `, ${relativeDayLabel(live.resolvedAt)}` : ''}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[15px] font-medium leading-snug text-fg">{preview.text}</p>
      {preview.code && (
        <CodeView code={preview.code} lineNumbers={false} fontSize={12.5} className="mt-2" />
      )}

      <div className="mt-3.5">
        <NoteField blockId={entry.blockId} initial={live?.note ?? ''} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {!retry ? (
          <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setRetry({ key: Date.now(), result: null })}>
            Yeniden dene
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<X className="size-3.5" />} onClick={() => setRetry(null)}>
            {retry.result ? 'Kapat' : 'Vazgeç'}
          </Button>
        )}
        <Link
          to={`/ders/${loc.lesson.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Derse git
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {retry && (
          <motion.div
            key={retry.key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <ItemSheet blockId={entry.blockId} mode="practice" onOutcome={onOutcome} eyebrow="Yeniden deneme" flat />
              {retry.result && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className={clsx(
                    'mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3',
                    retry.result === 'correct' ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft',
                  )}
                >
                  {retry.result === 'correct' ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-fg">
                      {retry.result === 'correct' ? 'Doğru! Bu hata defterden çıktı.' : 'İlk denemede yine olmadı.'}
                    </div>
                    <div className="text-xs text-muted">
                      {retry.result === 'correct'
                        ? 'Notun duruyor; Çözülenler bölümünden istediğin zaman okuyabilirsin.'
                        : 'Açıklamayı oku ve notunu güncelle. Birkaç gün sonra yeniden denemek, hemen tekrar etmekten daha kalıcıdır.'}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default function MistakeNotebook({ onFocusChange }: { onFocusChange: (focus: boolean) => void }) {
  const state = useProgress();
  const mistakes = state.mistakes;
  const [view, setView] = useState<View>('open');
  // Entries closed during this visit stay in the open list until the learner leaves the page.
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [session, setSession] = useState<{ id: number; items: PracticeItem[] } | null>(null);

  useEffect(() => {
    onFocusChange(!!session);
  }, [session, onFocusChange]);
  useEffect(() => () => onFocusChange(false), [onFocusChange]);

  const openGroups = useMemo(() => {
    const visible = Object.fromEntries(Object.entries(mistakes).map(([k, m]) => [k, pinned.has(k) ? { ...m, resolved: false } : m]));
    return mistakeGroups({ ...state, mistakes: visible }, false);
  }, [mistakes, pinned]);
  const resolvedGroups = useMemo(() => mistakeGroups(state, true), [mistakes]);
  const openCount = openMistakeCount(state);
  const resolvedCount = resolvedGroups.reduce((n, g) => n + g.count, 0);
  const groups = view === 'open' ? openGroups : resolvedGroups;

  const startAll = () => {
    const items = mistakeSession(useProgress.getState(), Date.now());
    setSession(items.length ? { id: Date.now(), items } : null);
  };
  const onResolved = (id: string) => setPinned((p) => new Set(p).add(id));

  if (session) {
    return (
      <PracticeRunner
        key={session.id}
        items={session.items}
        onClose={() => setSession(null)}
        onRestart={openMistakeCount(useProgress.getState()) ? startAll : undefined}
        restartLabel="Kalanları dene"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View>
          label="Hata defteri görünümü"
          value={view}
          onChange={setView}
          options={[
            { value: 'open', label: `Açık (${openCount})` },
            { value: 'resolved', label: `Çözülenler (${resolvedCount})` },
          ]}
        />
        {view === 'open' && openCount > 0 && (
          <Button icon={<ListRestart className="size-4" />} onClick={startAll}>
            Hepsini sırayla dene
          </Button>
        )}
      </div>

      {view === 'open' && openCount > 0 && (
        <p className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-xp" aria-hidden />
          <span>
            Neden yanıldığını kendi cümlenle yazmak, aynı hatayı tekrarlamanı zorlaştırır. Özellikle{' '}
            <strong className="font-semibold text-fg">emin olduğun hâlde</strong> yanıldığın sorular, düzeltildiğinde en kalıcı
            dersleri verir.
          </span>
        </p>
      )}

      {groups.length === 0 ? (
        view === 'open' ? (
          <EmptyState
            mood="celebrate"
            title="Hata defterin boş"
            actions={
              resolvedCount > 0 && (
                <Button variant="secondary" onClick={() => setView('resolved')}>
                  Çözdüklerine bak
                </Button>
              )
            }
          >
            Yanlış cevapladığın sorular buraya düşer. Neden yanıldığını not alır, soruyu yeniden denersin; ilk denemede doğru
            cevapladığında defterden çıkar.
          </EmptyState>
        ) : (
          <EmptyState mood="thinking" title="Henüz çözdüğün hata yok">
            Açık hatalarından birini ilk denemede doğru cevapladığında burada, notunla birlikte listelenir.
          </EmptyState>
        )
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.module.id} aria-labelledby={`mistakes-${g.module.id}`}>
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-surface text-lg" aria-hidden>
                  {g.module.icon}
                </span>
                <div className="min-w-0">
                  <h2 id={`mistakes-${g.module.id}`} className="truncate text-base font-semibold text-fg">
                    {g.module.title}
                  </h2>
                  <p className="text-xs text-muted">
                    Modül {g.module.number}, {g.count} {view === 'open' ? 'hata' : 'çözülen hata'}
                  </p>
                </div>
              </div>
              <div className="space-y-5 border-l border-border pl-4 sm:ml-4 sm:pl-6">
                {g.lessons.map((lg) => (
                  <div key={lg.lesson.id}>
                    <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-muted">
                      <ModuleTag module={g.module} compact />
                      {lg.lesson.title}
                    </h3>
                    <ul className="space-y-3">
                      <AnimatePresence initial={false}>
                        {lg.items.map((m) => (
                          <MistakeCard key={m.blockId} entry={m} onResolved={onResolved} />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
