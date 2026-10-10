// Self-explanation: the learner writes an answer in their own words, compares it with a model
// answer and rates how close it was. The draft is autosaved on this device.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { MessageSquareText } from 'lucide-react';
import type { ReflectBlock as ReflectBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import { useProgress } from '../../store/progress';
import { xpToast } from '../../store/ui';
import { draftStore } from '../editor/util';
import { XpPill } from './CheckUi';

const MIN_CHARS = 20;
type Rating = 1 | 2 | 3;

const RATINGS: { value: Rating; label: string; reply: string }[] = [
  { value: 3, label: 'Benzer', reply: 'Harika — kavramı kendi kelimelerinle kurabiliyorsun. Bu, gerçekten anladığının en iyi işareti.' },
  { value: 2, label: 'Kısmen', reply: 'Güzel bir başlangıç. Eksik kalan parçayı model cevaptan tamamla; bir sonraki tekrarda hatırlaman kolaylaşır.' },
  { value: 1, label: 'Farklıydı', reply: 'Sorun değil: farkı fark etmek öğrenmenin kendisi. Model cevabı bir kez daha oku ve ana fikri not al.' },
];

export default function ReflectBlock({ block, mode, onComplete, fresh }: BlockProps<ReflectBlockT>) {
  const restoring = mode === 'lesson' && !fresh;
  const draftKey = `rusteach-reflect:${block.id}`;
  const [stored] = useState(() => (restoring ? useProgress.getState().reflections[block.id] : undefined));
  const [text, setText] = useState(() => stored?.text ?? (restoring ? (draftStore.get(draftKey) ?? '') : ''));
  const [revealed, setRevealed] = useState(!!stored);
  const [skipped, setSkipped] = useState(false);
  const [rating, setRating] = useState<Rating | undefined>(stored?.rating);
  const [xp, setXp] = useState(0);
  const done = useRef(!!stored);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!restoring || revealed) return;
    const t = setTimeout(() => draftStore.set(draftKey, text), 400);
    return () => clearTimeout(t);
  }, [text, draftKey, restoring, revealed]);

  const finish = (correct: boolean) => {
    if (done.current) return;
    done.current = true;
    onCompleteRef.current?.({ correct, answer: text });
  };

  const enough = text.trim().length >= MIN_CHARS;

  const reveal = () => {
    if (!enough) return;
    setRevealed(true);
  };

  const skip = () => {
    setSkipped(true);
    setRevealed(true);
    finish(false);
  };

  const rate = (r: Rating) => {
    setRating(r);
    if (mode === 'lesson' || mode === 'practice') {
      const gained = useProgress.getState().setReflection(block.id, text.trim(), r);
      setXp(gained);
      xpToast(gained, 'Kendi cümlelerinle açıkladın');
    }
    draftStore.set(draftKey, '');
    finish(true);
  };

  const left = Math.max(0, MIN_CHARS - text.trim().length);

  return (
    <BlockFrame icon={<MessageSquareText className="size-4" />} label="Kendi cümlelerinle" state={rating ? 'correct' : 'idle'}>
      <Html html={block.prompt} className="font-medium" />
      {!skipped && (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!!rating}
            rows={4}
            className="lesson-textarea"
            placeholder="Kendi kelimelerinle, birine anlatır gibi yaz…"
            aria-label="Cevabın"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !revealed) {
                e.preventDefault();
                reveal();
              }
            }}
          />
        </div>
      )}

      {!revealed && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reveal}
            disabled={!enough}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Model cevabı göster
          </button>
          <span className="text-xs text-muted">
            {left > 0 ? `En az ${left} karakter daha yaz.` : 'Hazırsan karşılaştır.'}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={skip}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            Atla
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="mt-4 rounded-2xl border border-border bg-surface-2/70 p-4"
          >
            <div className="mb-1.5 text-xs font-semibold text-muted">Model cevap</div>
            <Html html={block.answer} size="sm" />
            {!skipped && (
              <div className="mt-4 border-t border-border pt-3">
                {!rating ? (
                  <>
                    <div className="mb-2 text-sm font-medium text-fg">Senin cevabın buna ne kadar yakındı?</div>
                    <div className="grid grid-cols-3 gap-2">
                      {RATINGS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => rate(r.value)}
                          className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        rating === 3 ? 'bg-success-soft text-success' : rating === 2 ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info',
                      )}
                    >
                      {RATINGS.find((r) => r.value === rating)?.label}
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-muted">{RATINGS.find((r) => r.value === rating)?.reply}</p>
                    <XpPill xp={xp} />
                  </div>
                )}
              </div>
            )}
            {skipped && (
              <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted">
                Bir dahaki sefere önce kendin yazmayı dene: cevabı kendi kelimelerinle kurmak, okumaktan çok daha kalıcıdır.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </BlockFrame>
  );
}
