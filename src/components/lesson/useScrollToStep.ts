// Scrolls the player's scroll container to a step section (after it has been rendered).
import { useCallback, useRef, type RefObject } from 'react';
import { useProgress } from '../../store/progress';

function reducedMotion(): boolean {
  return (
    useProgress.getState().settings.reducedMotion ||
    (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

export function useScrollToStep(scroller: RefObject<HTMLElement | null>) {
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const callbacks = useRef<((el: HTMLElement | null) => void)[]>([]);

  /** Stable ref callback for step `i` (keeps memoized step sections from re-rendering). */
  const refFor = useCallback((i: number) => {
    callbacks.current[i] ??= (el) => {
      stepRefs.current[i] = el;
    };
    return callbacks.current[i];
  }, []);

  /** Waits two frames so a just-revealed step is in the DOM, then brings it to the top. */
  const scrollToStep = useCallback(
    (index: number, smooth = true) => {
      let tries = 0;
      const go = () => {
        const el = stepRefs.current[index];
        const box = scroller.current;
        if (!el || !box) {
          if (tries++ < 10) requestAnimationFrame(go);
          return;
        }
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 24;
        box.scrollTo({ top: Math.max(0, top), behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
        // move keyboard focus to the new step's heading without scrolling again
        if (smooth) el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      };
      requestAnimationFrame(() => requestAnimationFrame(go));
    },
    [scroller],
  );

  const scrollTop = useCallback(() => {
    scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scroller]);

  return { stepRefs, refFor, scrollToStep, scrollTop };
}
