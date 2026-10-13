// Lesson flashcard deck preview: flip through the cards that will join the spaced-repetition deck.
import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Layers, RefreshCw } from 'lucide-react';
import type { FlashcardsBlock as FlashcardsBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import { useProgress } from '../../store/progress';
import { play } from '../../lib/sound';

export default function FlashcardsBlock({ block, mode }: BlockProps<FlashcardsBlockT>) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState(1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const inDeck = useProgress((s) => block.cards.every((c) => !!s.srs[c.id]));
  const cardRef = useRef<HTMLDivElement>(null);
  const total = block.cards.length;
  const card = block.cards[index];
  if (!card) return null;

  const go = (next: number) => {
    if (next < 0 || next >= total) return;
    setDir(next > index ? 1 : -1);
    setFlipped(false);
    setIndex(next);
  };

  const flip = () => {
    setFlipped((f) => !f);
    setSeen((s) => (s.has(index) ? s : new Set(s).add(index)));
    play('flip');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  const note =
    mode !== 'lesson'
      ? null
      : inDeck
        ? 'Bu kartlar tekrar destende; zamanı geldikçe Tekrar sayfasında karşına çıkacaklar.'
        : 'Bu kartlar ders bitince tekrar destene eklenecek. Aralıklı tekrarla bilgiyi kalıcı belleğe taşırsın.';

  return (
    <BlockFrame
      icon={<Layers className="size-4" />}
      label="Tekrar kartları"
      right={
        <span className="text-xs font-medium tabular-nums text-muted">
          {seen.size}/{total} çevrildi
        </span>
      }
    >
      <p className="text-sm text-muted">Önce cevabı aklından söyle, sonra kartı çevirip kendini kontrol et.</p>

      <div className="mt-4" onKeyDown={onKeyDown}>
        <div className="relative">
          {/* the next cards peeking behind the current one */}
          {index < total - 1 && (
            <div className="pointer-events-none absolute inset-x-6 -bottom-2 h-full rounded-2xl border border-border bg-surface-2/60" aria-hidden="true" />
          )}
          {index < total - 2 && (
            <div className="pointer-events-none absolute inset-x-12 -bottom-4 h-full rounded-2xl border border-border bg-surface-2/30" aria-hidden="true" />
          )}
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={card.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40, rotate: dir * 1.5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: dir * -40, rotate: dir * -1.5 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="relative"
            >
              <div
                ref={cardRef}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, .static-copy')) return;
                  flip();
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    flip();
                  }
                }}
                className="flip-card block w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                data-flipped={flipped}
                aria-pressed={flipped}
                aria-label={flipped ? 'Kartın cevap yüzü; ön yüze dönmek için bas' : 'Kartın soru yüzü; cevabı görmek için bas'}
              >
                <div className="flip-inner">
                  <div className="flip-face flip-front" aria-hidden={flipped}>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                      Soru
                      <span className="font-normal text-subtle">
                        {index + 1} / {total}
                      </span>
                    </div>
                    <Html html={card.front} className="flex-1 font-medium" />
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-subtle">
                      <RefreshCw className="size-3.5" /> <span className="kbd-only">
                        Çevirmek için tıkla ya da <span className="kbd-hint">Boşluk</span>
                      </span>
                      <span className="touch-only">Çevirmek için dokun</span>
                    </div>
                  </div>
                  <div className="flip-face flip-back" aria-hidden={!flipped}>
                    <div className="mb-2 text-xs font-semibold text-accent">Cevap</div>
                    <Html html={card.back} className="flex-1" />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="grid size-9 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Önceki kart"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-1.5" role="tablist" aria-label="Kartlar">
            {block.cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}. kart`}
                onClick={() => go(i)}
                className={clsx(
                  'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  i === index ? 'w-6 bg-accent' : seen.has(i) ? 'w-2 bg-accent/40' : 'w-2 bg-border-strong hover:bg-subtle',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === total - 1}
            className="grid size-9 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Sonraki kart"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {note && <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted">{note}</p>}
    </BlockFrame>
  );
}
