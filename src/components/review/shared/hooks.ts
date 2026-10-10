// Small hooks shared by the review, practice and stats pages.
import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../../../store/progress';

/** True when the keyboard event comes from a text field / editor, where shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('.cm-editor, [contenteditable="true"]')) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(type);
  }
  return false;
}

/**
 * Global single-key shortcuts (e.g. { ' ': reveal, '1': again }). Ignored while typing, with modifier
 * keys, on key repeat, or when another element already handled the event. A handler that returns
 * `false` did not use the key, so the event stays available to others (e.g. a quiz's number keys).
 * Pass only the keys that make sense right now — the map is read at key-press time.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => boolean | void>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const fn = ref.current[e.key];
      if (!fn) return;
      // Space/Enter on a focused button would also "click" it — let the button do its own job.
      if ((e.key === ' ' || e.key === 'Enter') && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"], [role="tab"], [role="radio"]')) return;
      if (fn(e) !== false) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Respects the in-app "reduced motion" setting as well as the OS preference. */
export function useReducedMotionSetting(): boolean {
  const setting = useProgress((s) => s.settings.reducedMotion);
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setOs(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return setting || os;
}

/**
 * Counts active study time while a session is running (window visible, input in the last 90 s) and
 * adds it to the learner's study time in small batches.
 */
export function useStudyClock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let pending = 0;
    let last = Date.now();
    let lastInput = Date.now();
    const onInput = () => {
      lastInput = Date.now();
    };
    const flush = () => {
      const secs = Math.round(pending);
      pending = 0;
      if (secs > 0) useProgress.getState().addStudyTime(secs);
    };
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastInput < 90_000) pending += (now - last) / 1000;
      last = now;
      if (pending >= 30) flush();
    };
    window.addEventListener('pointerdown', onInput);
    window.addEventListener('keydown', onInput);
    const id = window.setInterval(tick, 5000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('keydown', onInput);
      tick();
      flush();
    };
  }, [active]);
}

/** Seconds elapsed since `start` (ms), re-rendering once per second. */
export function useElapsed(start: number, running = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** Persisted per-viewer UI preference in localStorage (fails soft in private windows). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the value simply is not remembered */
  }
}

/** Current time, refreshed every `intervalMs` and whenever the window regains focus. */
export function useClock(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}
