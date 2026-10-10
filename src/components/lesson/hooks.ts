// Small hooks for the lesson player: active study time, XP earned this session, Enter-to-continue.
import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../../store/progress';

const IDLE_MS = 90_000;

/**
 * Counts active study seconds (window visible and the learner interacted in the last 90 s) and
 * adds them to the learner's study time in batches. Returns a ref with the seconds of this visit.
 */
export function useStudyTimer(active = true) {
  const seconds = useRef(0);
  useEffect(() => {
    if (!active) return;
    let pending = 0;
    let last = Date.now();
    let lastInput = Date.now();
    const onInput = () => {
      lastInput = Date.now();
    };
    const flush = () => {
      const s = Math.round(pending);
      pending -= s;
      if (s > 0) useProgress.getState().addStudyTime(s);
    };
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastInput < IDLE_MS) {
        const d = (now - last) / 1000;
        pending += d;
        seconds.current += d;
      }
      last = now;
      if (pending >= 30) flush();
    };
    const timer = window.setInterval(tick, 5000);
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    const onHide = () => {
      tick();
      flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener('visibilitychange', onHide);
      tick();
      flush();
    };
  }, [active]);
  return seconds;
}

/** XP gained since the component mounted. */
export function useSessionXp(): number {
  const [start] = useState(() => useProgress.getState().xp);
  const xp = useProgress((s) => s.xp);
  return Math.max(0, xp - start);
}

/** Calls `onEnter` for a bare Enter press when focus is not on an interactive element. */
export function useEnterKey(enabled: boolean, onEnter: () => void) {
  const cb = useRef(onEnter);
  cb.current = onEnter;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target instanceof Element ? e.target : null;
      const interactive = t && t !== document.body
        ? t.closest<HTMLElement>('button, a, input, textarea, select, [role="button"], [contenteditable="true"], .cm-editor, [role="radio"], [role="checkbox"], [role="tab"]')
        : null;
      // a focused control that just got disabled (e.g. an answered option) should not swallow Enter
      if (interactive && !(interactive instanceof HTMLButtonElement && interactive.disabled)) return;
      e.preventDefault();
      cb.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return '1 dakikadan az';
  if (m < 60) return `${m} dakika`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}

/** Focuses the returned element once after mount without scrolling it into view. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, []);
  return ref;
}
