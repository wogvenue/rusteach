// Small helpers shared by the editor, blocks and lesson player.

const KNOWN_CRATES = [
  'rand', 'serde', 'serde_json', 'tokio', 'regex', 'itertools', 'anyhow', 'thiserror',
  'rayon', 'chrono', 'futures', 'tokio_stream', 'once_cell', 'clap', 'reqwest',
];

/** Mirrors detectCrates() in scripts/lib/lesson-parser.mjs (for free-form playground code). */
export function detectCrates(code: string): string[] {
  const found = new Set<string>();
  for (const c of KNOWN_CRATES) {
    const re = new RegExp(`(^|[^A-Za-z0-9_:])${c}::|use\\s+${c}\\b|extern\\s+crate\\s+${c}\\b|#\\[${c}::`);
    if (re.test(code)) found.add(c);
  }
  if (/derive\([^)]*\b(Serialize|Deserialize)\b/.test(code)) found.add('serde');
  return [...found];
}

/** Opens a URL in the system browser (Electron) or a new tab. */
export function openExternal(url: string) {
  if (window.rusteach) void window.rusteach.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Plain text of trusted HTML (for short labels). */
export function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Deterministic PRNG seeded from a string (mulberry32 over a FNV-1a hash). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: T[], seed: string): T[] {
  const rnd = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Reads/writes small per-device UI drafts in localStorage, never throwing. */
export const draftStore = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  },
};

/** Is the event target a text-entry element where global shortcuts must not fire? */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"], .cm-editor');
}
