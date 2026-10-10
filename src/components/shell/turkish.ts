// Turkish formatting helpers for shell pages.

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** Monday-first, like the Turkish calendar. */
export const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('tr-TR');
}

/** Turkish puts the percent sign first: %80 */
export function fmtPct(v: number): string {
  return `%${Math.round(v * 100)}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "8 Ekim 2026" */
export function fmtDate(input: string | Date, withYear = true): string {
  const d = typeof input === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(input) ? parseDayKey(input) : new Date(input)) : input;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "8 Ekim Çarşamba" */
export function fmtDayLong(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${WEEKDAYS[weekdayIndex(d)]}`;
}

/** "bugün", "dün", "3 gün önce", "2 hafta önce", or a date. */
export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((b - a) / 86_400_000);
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return fmtDate(d);
}

/** "45 dk", "3 sa 20 dk" */
export function fmtDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

const BACK = 'aıouAIOU';
const BACK_ROUND = 'ouOU';
const FRONT_ROUND = 'öüÖÜ';
const VOWELS = 'aeıioöuüAEIİOÖUÜâîûÂÎÛ';

/**
 * Genitive suffix with apostrophe for a proper name, following vowel harmony:
 * "Hikmet" → "Hikmet'in", "Ayşe" → "Ayşe'nin", "Can" → "Can'ın", "Umut" → "Umut'un", "Gül" → "Gül'ün".
 */
export function genitive(name: string): string {
  const n = name.trim();
  if (!n) return n;
  let last = '';
  for (let i = n.length - 1; i >= 0; i--) {
    if (VOWELS.includes(n[i])) {
      last = n[i];
      break;
    }
  }
  let v = 'i';
  if (BACK_ROUND.includes(last)) v = 'u';
  else if (FRONT_ROUND.includes(last)) v = 'ü';
  else if (BACK.includes(last)) v = 'ı';
  const endsWithVowel = VOWELS.includes(n[n.length - 1]);
  return `${n}’${endsWithVowel ? 'n' : ''}${v}n`;
}

/** Turkish-aware case folding for search. */
export function fold(s: string): string {
  return s.toLocaleLowerCase('tr').normalize('NFC');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Time-of-day greeting. */
export function greeting(d = new Date()): { text: string; mood: 'morning' | 'day' | 'evening' | 'night' } {
  const h = d.getHours();
  if (h >= 5 && h < 12) return { text: 'Günaydın', mood: 'morning' };
  if (h >= 12 && h < 18) return { text: 'İyi günler', mood: 'day' };
  if (h >= 18 && h < 23) return { text: 'İyi akşamlar', mood: 'evening' };
  return { text: 'İyi geceler', mood: 'night' };
}
