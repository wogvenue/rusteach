// Slide-in notes drawer (Feynman technique): the learner's own explanation of the lesson, saved per lesson.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, NotebookPen, X } from 'lucide-react';
import { useProgress } from '../../store/progress';

export default function NotesPanel({ lessonId, open, onClose }: { lessonId: string; open: boolean; onClose: () => void }) {
  const stored = useProgress((s) => s.notes[lessonId] ?? '');
  const [text, setText] = useState(stored);
  const [saved, setSaved] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);

  // pick up outside changes (e.g. the completion summary) while the panel is closed
  useEffect(() => {
    if (!open) setText(stored);
  }, [stored, open]);

  useEffect(() => {
    if (text === stored) {
      setSaved(true);
      return;
    }
    setSaved(false);
    const t = setTimeout(() => {
      useProgress.getState().setNote(lessonId, text);
      setSaved(true);
    }, 500);
    return () => clearTimeout(t);
  }, [text, stored, lessonId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => area.current?.focus({ preventScroll: true }), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="fixed bottom-0 right-0 z-40 flex w-[min(380px,100vw)] max-md:top-0 max-md:pt-[var(--safe-area-inset-top,env(safe-area-inset-top))] md:top-14 flex-col border-l border-border bg-elevated shadow-pop"
          aria-label="Notlarım"
          data-back-closes
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <NotebookPen className="size-4 text-accent" />
            <span className="font-semibold text-fg">Notlarım</span>
            <span className="inline-flex items-center gap-1 text-xs text-subtle" aria-live="polite">
              {saved ? (
                <>
                  <Check className="size-3.5" /> kaydedildi
                </>
              ) : (
                'kaydediliyor…'
              )}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Notları kapat"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="px-4 pt-3 text-xs leading-relaxed text-muted">
            Bu dersi hiç bilmeyen bir arkadaşına anlatır gibi yaz. Takıldığın yer, henüz tam anlamadığın yerdir.
          </p>
          <textarea
            ref={area}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="m-4 flex-1 resize-none rounded-2xl border border-border bg-surface p-3.5 text-[0.95rem] leading-relaxed text-fg outline-none placeholder:text-subtle focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            placeholder="Kendi cümlelerinle…"
            aria-label="Ders notların"
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
