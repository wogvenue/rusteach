// Popover explaining a compiler error code (E0382…) from content.reference.errors.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import { content } from '../../lib/content';
import { openExternal } from './util';

export default function ErrorCodePopover({
  code,
  anchor,
  onClose,
}: {
  code: string;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const entry = content.reference.errors.find((e) => e.code === code);
  const officialUrl = `https://doc.rust-lang.org/error_codes/${code}.html`;

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const r = anchor.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const fitsBelow = r.bottom + 8 + h <= window.innerHeight - 8;
      const top = fitsBelow || r.top - 8 - h < 8 ? Math.min(r.bottom + 8, window.innerHeight - h - 8) : r.top - 8 - h;
      const left = Math.min(Math.max(8, r.left - 20), window.innerWidth - w - 8);
      setPos({ top: Math.max(8, top), left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={`${code} hata açıklaması`}
      tabIndex={-1}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed z-[120] w-[min(400px,calc(100vw-16px))] rounded-2xl border border-border bg-elevated p-4 text-fg shadow-2xl outline-none"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, fontFamily: 'var(--font-sans)' }}
    >
      <div className="mb-2 flex items-start gap-2.5">
        <span className="err-chip shrink-0 font-mono" style={{ cursor: 'default' }}>
          {code}
        </span>
        <div className="min-w-0 flex-1 text-[0.95rem] font-semibold leading-snug">
          {entry ? entry.title : 'Derleyici hata kodu'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
      </div>
      {entry ? (
        <div className="max-h-[42vh] overflow-y-auto pr-1">
          <div className="lesson-prose prose-xs text-muted" dangerouslySetInnerHTML={{ __html: entry.explanation }} />
          {entry.fixExplanation && (
            <div className="mt-3 rounded-xl border border-success/25 bg-success/5 p-3">
              <div className="mb-1 text-xs font-semibold text-success">Nasıl düzeltilir?</div>
              <div className="lesson-prose prose-xs" dangerouslySetInnerHTML={{ __html: entry.fixExplanation }} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Bu kod için rehberde henüz bir açıklama yok. Derleyicinin mesajı çoğu zaman sorunun yerini ve çözümünü
          gösterir; ayrıntı için terminalde <code className="inline-code">rustc --explain {code}</code> komutunu
          çalıştırabilirsin.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => openExternal(officialUrl)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          <BookOpen className="size-3.5" />
          Resmî açıklamayı aç
          <ExternalLink className="size-3" />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
