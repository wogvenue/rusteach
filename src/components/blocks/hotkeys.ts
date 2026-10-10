// Scoped number-key shortcuts for check blocks. Several blocks can be on screen at once (earlier
// steps stay visible), so a key goes to the block that contains focus, otherwise to the first
// still-active block (DOM order) that is visible in the viewport.
import { useEffect, useRef, type RefObject } from 'react';
import { isTypingTarget } from '../editor/util';

interface Entry {
  el: HTMLElement | null;
  active: () => boolean;
  onKey: (e: KeyboardEvent) => boolean;
}

const entries = new Set<Entry>();
let installed = false;

function inViewport(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.bottom > 40 && r.top < window.innerHeight - 40 && r.width > 0;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (isTypingTarget(e.target)) return;
  const list = [...entries].filter((x) => x.el && x.el.isConnected);
  const active = document.activeElement;
  let target = list.find((x) => active && x.el!.contains(active) && x.active());
  if (!target) {
    const candidates = list.filter((x) => x.active() && inViewport(x.el!));
    candidates.sort((a, b) => (a.el!.compareDocumentPosition(b.el!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    target = candidates[0];
  }
  if (target && target.onKey(e)) e.preventDefault();
}

export function useBlockHotkeys(
  ref: RefObject<HTMLElement | null>,
  active: () => boolean,
  onKey: (e: KeyboardEvent) => boolean,
) {
  const entry = useRef<Entry>({ el: null, active, onKey }).current;
  entry.active = active;
  entry.onKey = onKey;
  useEffect(() => {
    if (!installed) {
      installed = true;
      window.addEventListener('keydown', onKeyDown);
    }
    entry.el = ref.current;
    entries.add(entry);
    return () => {
      entries.delete(entry);
    };
  }, [entry, ref]);
}

/** Maps 1-9 and a-i to an index (or -1). */
export function keyIndex(e: KeyboardEvent): number {
  if (/^[1-9]$/.test(e.key)) return Number(e.key) - 1;
  const k = e.key.toLowerCase();
  if (k.length === 1 && k >= 'a' && k <= 'i') return k.charCodeAt(0) - 97;
  return -1;
}
