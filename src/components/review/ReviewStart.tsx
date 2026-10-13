// Start screen of a review session: due count, breakdown, session size and the "why interleave" note.
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Layers, Play, Sparkles, SquareStack } from 'lucide-react';
import type { SrsEntry } from '../../store/progress';
import { getModule } from '../../lib/content';
import { estimateMinutes } from '../../lib/practice';
import { formatNumber } from '../../lib/stats';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import DeckHero from './DeckHero';
import InterleaveNote from './InterleaveNote';
import { useHotkeys } from './shared/hooks';
import type { Module } from '../../types/content';

export type SessionSize = '10' | '20' | 'all';

function sizeOptions(due: number): SessionSize[] {
  if (due <= 10) return ['all'];
  if (due <= 20) return ['10', 'all'];
  return ['10', '20', 'all'];
}

export function pickEntries(due: SrsEntry[], size: SessionSize): SrsEntry[] {
  return size === 'all' ? due : due.slice(0, Number(size));
}

export default function ReviewStart({ due, onStart }: { due: SrsEntry[]; onStart: (size: SessionSize) => void }) {
  const options = sizeOptions(due.length);
  const [size, setSize] = useState<SessionSize>(due.length <= 20 ? 'all' : '20');
  const selected = useMemo(() => pickEntries(due, size), [due, size]);

  const flashcards = selected.filter((e) => e.kind === 'flashcard').length;
  const checks = selected.length - flashcards;
  const fresh = selected.filter((e) => e.card.state === 0).length;
  const minutes = estimateMinutes(selected);

  const byModule = useMemo(() => {
    const map = new Map<string, { module: Module; count: number }>();
    for (const e of selected) {
      const m = getModule(e.moduleId);
      if (!m) continue;
      const row = map.get(m.id) ?? { module: m, count: 0 };
      row.count++;
      map.set(m.id, row);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.module.order - b.module.order);
  }, [selected]);
  const maxCount = Math.max(1, ...byModule.map((r) => r.count));
  const colors = byModule.map((r) => r.module.color);

  useHotkeys({ Enter: () => onStart(size) });

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 pb-8 pt-8 text-center"
        aria-labelledby="review-hero-title"
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
        <div className="relative">
          <DeckHero count={due.length} colors={colors} caption="kart seni bekliyor" />
          <h2 id="review-hero-title" className="mt-6 text-2xl font-semibold tracking-tight text-fg">
            Bugünkü tekrarın hazır
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Bu kartlar unutma eşiğine yaklaştı. Tam şimdi hatırlamaya çalışmak, onları haftalarca kalıcı yapar.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button size="lg" icon={<Play className="size-4" />} onClick={() => onStart(size)} className="min-w-56">
              Tekrara başla
            </Button>
            <span className="kbd-only text-xs text-subtle">
              ya da <Kbd>Enter</Kbd>
            </span>
          </div>
        </div>
      </motion.section>

      <div className="flex flex-col gap-5">
        <section className="rounded-3xl border border-border bg-surface p-5" aria-labelledby="session-plan-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="session-plan-title" className="text-base font-semibold text-fg">
              Bu oturumda
            </h2>
            <Segmented
              label="Oturum boyutu"
              size="sm"
              value={size}
              onChange={setSize}
              options={options.map((o) => ({ value: o, label: o === 'all' ? `Tümü (${due.length})` : o }))}
            />
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface-2/70 px-3 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <SquareStack className="size-3.5" aria-hidden /> Bilgi kartı
              </dt>
              <dd className="mt-1 text-xl font-semibold text-fg">{formatNumber(flashcards)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-2/70 px-3 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Layers className="size-3.5" aria-hidden /> Soru
              </dt>
              <dd className="mt-1 text-xl font-semibold text-fg">{formatNumber(checks)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-2/70 px-3 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Clock3 className="size-3.5" aria-hidden /> Süre
              </dt>
              <dd className="mt-1 text-xl font-semibold text-fg">≈ {minutes} dk</dd>
            </div>
          </dl>
          {fresh > 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Sparkles className="size-3.5 text-xp" aria-hidden />
              {fresh} kart ilk kez karşına çıkacak.
            </p>
          )}

          {byModule.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-muted">Modüllere göre</h3>
              <ul className="mt-2 space-y-2">
                {byModule.map(({ module, count }) => (
                  <li key={module.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span aria-hidden>{module.icon}</span>
                        <span className="truncate font-medium text-fg">{module.title}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: module.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / maxCount) * 100}%` }}
                          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-fg lx-tabular">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <InterleaveNote colors={colors} />
      </div>
    </div>
  );
}
