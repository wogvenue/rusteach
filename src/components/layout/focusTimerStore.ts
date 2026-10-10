// Pomodoro-style focus timer (25 min focus / 5 min break). Lives outside React so it keeps
// running while the learner is inside a lesson (which renders outside the app shell).
import { create } from 'zustand';
import { play } from '../../lib/sound';
import { toast } from '../../store/ui';
import { dayKey } from '../../store/progress';

export type FocusPhase = 'focus' | 'break';
export const FOCUS_MS = 25 * 60_000;
export const BREAK_MS = 5 * 60_000;

interface FocusState {
  phase: FocusPhase;
  running: boolean;
  endsAt: number | null; // epoch ms while running
  remaining: number; // ms left while paused / idle
  sessions: number; // finished focus rounds today
  sessionsDay: string;
  start(): void;
  pause(): void;
  reset(): void;
  skip(): void;
}

let handle: number | undefined;

const phaseLength = (p: FocusPhase) => (p === 'focus' ? FOCUS_MS : BREAK_MS);

export const useFocusTimer = create<FocusState>()((set, get) => {
  const schedule = (ms: number) => {
    window.clearTimeout(handle);
    handle = window.setTimeout(onTimeout, Math.max(0, ms));
  };

  const onTimeout = () => {
    const s = get();
    if (!s.running || !s.endsAt) return;
    const left = s.endsAt - Date.now();
    if (left > 250) return schedule(left); // throttled background timers can fire early/late
    finishPhase(true);
  };

  const finishPhase = (natural: boolean) => {
    const s = get();
    window.clearTimeout(handle);
    if (s.phase === 'focus') {
      const today = dayKey();
      const sessions = natural ? (s.sessionsDay === today ? s.sessions + 1 : 1) : s.sessionsDay === today ? s.sessions : 0;
      if (natural) {
        play('focusEnd');
        toast({
          kind: 'info',
          icon: '☕',
          title: 'Mola zamanı',
          description: '25 dakika odaklandın. Beş dakika ekrandan uzaklaş; beynin bu arada öğrendiklerini yerleştirir.',
          duration: 7000,
        });
      }
      // breaks start automatically
      set({ phase: 'break', running: true, endsAt: Date.now() + BREAK_MS, remaining: BREAK_MS, sessions, sessionsDay: today });
      schedule(BREAK_MS);
    } else {
      if (natural) {
        play('breakEnd');
        toast({ kind: 'info', icon: '🍅', title: 'Mola bitti', description: 'Hazır olduğunda yeni bir odak turu başlat.', duration: 6000 });
      }
      set({ phase: 'focus', running: false, endsAt: null, remaining: FOCUS_MS });
    }
  };

  return {
    phase: 'focus',
    running: false,
    endsAt: null,
    remaining: FOCUS_MS,
    sessions: 0,
    sessionsDay: dayKey(),
    start: () => {
      const s = get();
      if (s.running) return;
      const remaining = s.remaining > 0 ? s.remaining : phaseLength(s.phase);
      set({ running: true, endsAt: Date.now() + remaining, remaining });
      schedule(remaining);
      if (s.phase === 'focus') play('focusStart');
    },
    pause: () => {
      const s = get();
      if (!s.running || !s.endsAt) return;
      window.clearTimeout(handle);
      set({ running: false, remaining: Math.max(0, s.endsAt - Date.now()), endsAt: null });
    },
    reset: () => {
      window.clearTimeout(handle);
      set({ phase: 'focus', running: false, endsAt: null, remaining: FOCUS_MS });
    },
    skip: () => finishPhase(false),
  };
});

export function timeLeft(s: Pick<FocusState, 'running' | 'endsAt' | 'remaining'>, now = Date.now()): number {
  return s.running && s.endsAt ? Math.max(0, s.endsAt - now) : s.remaining;
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function isTimerActive(s: Pick<FocusState, 'running' | 'phase' | 'remaining'>): boolean {
  return s.running || s.phase === 'break' || s.remaining !== FOCUS_MS;
}
