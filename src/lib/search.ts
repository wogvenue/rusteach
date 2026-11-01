// Global search index (Ctrl+K). Built lazily on first use from the content bundle:
// lessons (title, keywords, objectives, step titles, prose and code), modules, glossary and error codes.
// Matching is Turkish-aware (İ/ı) and every query word must match somewhere (AND).
import { content, lessons, modules, getModule } from './content';
import { stripHtml } from '../components/shell/turkish';
import { NAV_GROUPS } from '../components/layout/routes';

export type SearchKind = 'sayfa' | 'modul' | 'ders' | 'sozluk' | 'hata';

export interface SearchHit {
  kind: SearchKind;
  /** Stable key. */
  id: string;
  title: string;
  /** Second line: module name, step title, definition... */
  context: string;
  /** Text excerpt around the match (body hits only). */
  snippet?: string;
  /** Route to open. */
  to: string;
  /** Lesson id, when the hit is a lesson (the palette checks whether it is locked). */
  lessonId?: string;
  moduleId?: string;
  score: number;
}

interface Field {
  /** Folded text. */
  text: string;
  weight: number;
  /** Original text, used for snippets and context. */
  raw: string;
  label?: string;
}

interface Entry {
  kind: SearchKind;
  id: string;
  title: string;
  context: string;
  to: string;
  lessonId?: string;
  moduleId?: string;
  fields: Field[];
}

let index: Entry[] | null = null;

/**
 * Search-specific folding: case-insensitive, and Turkish letters match their ASCII forms
 * (ı/İ/I -> i, ş -> s, ğ -> g, ç -> c, ö -> o, ü -> u), so "Iterator" finds "iterator"
 * and "sahiplik" finds "Sahiplik". Length-preserving for these letters.
 */
export function fold(s: string): string {
  return s
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i');
}

const field = (raw: string, weight: number, label?: string): Field => ({ raw, text: fold(raw), weight, label });

function build(): Entry[] {
  const out: Entry[] = [];

  for (const group of NAV_GROUPS)
    for (const item of group)
      out.push({ kind: 'sayfa', id: `sayfa:${item.to}`, title: item.label, context: 'Sayfa', to: item.to, fields: [field(item.label, 10)] });

  for (const m of modules) {
    out.push({
      kind: 'modul',
      id: `modul:${m.id}`,
      title: `Modül ${m.number}: ${m.title}`,
      context: m.subtitle,
      to: `/modul/${m.id}`,
      moduleId: m.id,
      fields: [field(m.title, 12), field(m.subtitle, 5), field(stripHtml(m.description), 2), field(stripHtml(m.summaryHtml), 1.5, 'Özet Kartı')],
    });
  }

  for (const lesson of Object.values(lessons)) {
    const mod = getModule(lesson.moduleId);
    const fields: Field[] = [field(lesson.title, 12)];
    for (const k of lesson.keywords) fields.push(field(k, 8));
    for (const o of lesson.objectives) fields.push(field(stripHtml(o), 3));
    for (const step of lesson.steps) {
      const stepTitle = stripHtml(step.titleHtml || step.title);
      if (stepTitle) fields.push(field(stepTitle, 6, stepTitle));
      let body = '';
      for (const b of step.blocks) {
        if (b.type === 'md') body += ` ${stripHtml(b.html)}`;
        else if (b.type === 'code') body += ` ${b.display}`;
      }
      body = body.replace(/\s+/g, ' ').trim();
      if (body) fields.push(field(body, 1.5, stepTitle || undefined));
    }
    out.push({
      kind: 'ders',
      id: `ders:${lesson.id}`,
      title: lesson.title,
      context: mod ? `Modül ${mod.number}: ${mod.title}${lesson.type === 'boss' ? ' · Usta sınavı' : ''}` : '',
      to: `/ders/${lesson.id}`,
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
      fields,
    });
  }

  content.reference.glossary.forEach((g, i) => {
    out.push({
      kind: 'sozluk',
      id: `sozluk:${i}`,
      title: `${g.tr} · ${g.en}`,
      context: stripHtml(g.def),
      to: `/sozluk?ara=${encodeURIComponent(g.tr)}`,
      fields: [field(g.tr, 12), field(g.en, 12), field(stripHtml(g.def), 2)],
    });
  });

  for (const e of content.reference.errors) {
    out.push({
      kind: 'hata',
      id: `hata:${e.code}`,
      title: `${e.code}: ${e.title}`,
      context: stripHtml(e.explanation),
      to: `/sozluk?hata=${encodeURIComponent(e.code)}`,
      fields: [field(e.code, 20), field(e.title, 10), field(stripHtml(e.explanation), 2)],
    });
  }

  return out;
}

/** Splits a query into folded words. */
export function queryWords(q: string): string[] {
  return fold(q).split(/\s+/).filter(Boolean);
}

function snippetAround(raw: string, folded: string, word: string): string {
  const at = folded.indexOf(word);
  if (at < 0) return raw.slice(0, 120);
  // folding can change string length for rare characters; fall back to the folded offsets only when equal
  const pos = folded.length === raw.length ? at : Math.min(at, Math.max(0, raw.length - 1));
  const start = Math.max(0, pos - 45);
  const end = Math.min(raw.length, pos + word.length + 85);
  return `${start > 0 ? '…' : ''}${raw.slice(start, end).trim()}${end < raw.length ? '…' : ''}`;
}

export function search(q: string, limit = 40): SearchHit[] {
  const words = queryWords(q);
  if (!words.length) return [];
  index ??= build();
  const hits: SearchHit[] = [];

  for (const entry of index) {
    let total = 0;
    let bestBody: { f: Field; w: string; weight: number } | null = null;
    let ok = true;
    for (const w of words) {
      let best = 0;
      for (const f of entry.fields) {
        let at = f.text.indexOf(w);
        // very short words ("rc", "fn") must start a word, otherwise they match inside "parçacığı", "bildirim"...
        while (at > 0 && w.length < 3 && /[\p{L}\p{N}]/u.test(f.text[at - 1])) at = f.text.indexOf(w, at + 1);
        if (at < 0) continue;
        let s = f.weight;
        if (at === 0) s *= 1.6; // starts with
        else if (/[\s:_\-/(]/.test(f.text[at - 1] ?? '')) s *= 1.25; // word start
        if (f.text === w) s *= 1.5; // exact
        if (s > best) {
          best = s;
          if (f.weight <= 6) bestBody = { f, w, weight: s };
        }
      }
      if (!best) {
        ok = false;
        break;
      }
      total += best;
    }
    if (!ok) continue;

    let context = entry.context;
    let snippet: string | undefined;
    if (entry.kind === 'ders' && bestBody) {
      // body / step-title hit: show which step and a text excerpt
      if (bestBody.f.label) context = `${context} › ${bestBody.f.label}`;
      if (bestBody.f.weight <= 2) snippet = snippetAround(bestBody.f.raw, bestBody.f.text, bestBody.w);
    }
    hits.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      context,
      snippet,
      to: entry.to,
      lessonId: entry.lessonId,
      moduleId: entry.moduleId,
      score: entry.kind === 'ders' && entry.title.startsWith('Boss') ? total * 0.75 : total, // usta sınavları listelenen anahtar sözcüklerle öne geçmesin
    });
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'tr'));
  return hits.slice(0, limit);
}

/** Pages shown while the query is empty. */
export function quickPages(): SearchHit[] {
  return NAV_GROUPS.flat().map((item) => ({
    kind: 'sayfa' as const,
    id: `sayfa:${item.to}`,
    title: item.label,
    context: 'Sayfa',
    to: item.to,
    score: 0,
  }));
}
