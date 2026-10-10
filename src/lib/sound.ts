// Tiny synthesized sound effects (WebAudio, no assets). Respect settings.sound.
import { useProgress } from '../store/progress';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // a gentle low-pass + master gain keeps every effect soft and consistent
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(lp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, attack = 0.015) {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Soft bell: fundamental + an inharmonic partial with a long decay. */
function bell(freq: number, start: number, gain = 0.06) {
  tone(freq, start, 1.6, 'sine', gain, 0.008);
  tone(freq * 2.76, start, 0.7, 'sine', gain * 0.25, 0.006);
  tone(freq * 5.4, start, 0.35, 'sine', gain * 0.08, 0.004);
}

export type SoundName =
  | 'correct'
  | 'wrong'
  | 'click'
  | 'complete'
  | 'levelUp'
  | 'achievement'
  | 'flip'
  | 'focusStart'
  | 'focusEnd'
  | 'breakEnd';

export function play(name: SoundName) {
  if (!useProgress.getState().settings.sound) return;
  switch (name) {
    case 'correct':
      tone(660, 0, 0.12, 'triangle');
      tone(990, 0.08, 0.2, 'triangle');
      break;
    case 'wrong':
      tone(220, 0, 0.18, 'sawtooth', 0.035);
      tone(185, 0.1, 0.22, 'sawtooth', 0.03);
      break;
    case 'click':
      tone(880, 0, 0.04, 'square', 0.018);
      break;
    case 'flip':
      tone(520, 0, 0.06, 'triangle', 0.04);
      break;
    case 'complete':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.24, 'triangle'));
      break;
    case 'levelUp':
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.26, 'triangle', 0.065));
      bell(1568, 0.45, 0.04);
      break;
    case 'achievement':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.3, 'sine', 0.065));
      bell(2093, 0.28, 0.025);
      break;
    case 'focusStart':
      tone(523, 0, 0.22, 'sine', 0.05);
      tone(784, 0.12, 0.3, 'sine', 0.045);
      break;
    case 'focusEnd':
      bell(880, 0, 0.06);
      bell(1318.5, 0.35, 0.045);
      break;
    case 'breakEnd':
      bell(659, 0, 0.05);
      bell(988, 0.3, 0.04);
      bell(1318.5, 0.6, 0.035);
      break;
  }
}
