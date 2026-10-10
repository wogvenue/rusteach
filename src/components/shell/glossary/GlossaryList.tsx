// "Sözlük" tab: Turkish-aware search over TR / EN terms and definitions, alphabetical sections
// with a letter jump bar, and a chip linking each term to the module that teaches it.
import { useDeferredValue, useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import Ferris from '../../Ferris';
import { Button } from '../../ui/Button';
import SearchField from './SearchField';
import ModuleChip from './ModuleChip';
import { content } from '../../../lib/content';
import { fold, fmtNum, stripHtml } from '../turkish';
import { prefersReducedMotion } from '../../ui/motion';
import type { GlossaryEntry } from '../../../types/content';

interface Indexed {
  e: GlossaryEntry;
  letter: string;
  sort: string;
  hay: string;
  key: string;
}

/** "? operatörü" and "'static" are filed under their first letter (O, S). */
const sortKey = (tr: string) => tr.trim().replace(/^[^\p{L}\p{N}]+/u, '') || tr.trim();

const ENTRIES: Indexed[] = content.reference.glossary
  .map((e) => ({
    e,
    letter: (sortKey(e.tr)[0] ?? '#').toLocaleUpperCase('tr'),
    sort: sortKey(e.tr),
    hay: fold(`${e.tr} ${e.en} ${stripHtml(e.def)}`),
    key: `${e.tr}|${e.en}`,
  }))
  .sort((a, b) => a.sort.localeCompare(b.sort, 'tr', { sensitivity: 'base' }));

/** Ranks term matches above definition matches. */
function score(x: Indexed, q: string): number {
  const tr = fold(x.e.tr);
  const en = fold(x.e.en);
  if (tr === q || en === q) return 0;
  if (tr.startsWith(q) || en.startsWith(q)) return 1;
  if (tr.includes(q) || en.includes(q)) return 2;
  return 3;
}

export default function GlossaryList({ onShowErrors }: { onShowErrors: () => void }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const q = fold(deferred.trim());

  const results = useMemo(() => {
    if (!q) return ENTRIES;
    return ENTRIES.filter((x) => x.hay.includes(q)).sort((a, b) => score(a, q) - score(b, q));
  }, [q]);

  const sections = useMemo(() => {
    if (q) return [];
    const map = new Map<string, Indexed[]>();
    for (const x of results) map.set(x.letter, [...(map.get(x.letter) ?? []), x]);
    return [...map.entries()];
  }, [results, q]);

  if (!ENTRIES.length) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <Ferris size={104} mood="thinking" />
        <h2 className="mt-3 text-[17px] font-semibold text-fg">Sözlük hazırlanıyor</h2>
        <p className="mt-1 max-w-[48ch] text-sm leading-6 text-muted">
          Derslerde geçen Rust terimlerinin Türkçe ve İngilizce karşılıkları yakında burada olacak. Bu arada derleyici hatalarına
          Hata Rehberi’nden bakabilirsin.
        </p>
        <Button className="mt-5" variant="secondary" onClick={onShowErrors}>
          Hata Rehberi’ni aç
        </Button>
      </div>
    );
  }

  const jump = (letter: string) => {
    document.getElementById(`harf-${letter}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Sözlükte ara"
          placeholder="Terim ara: ödünç alma, borrow, yaşam süresi…"
          className="min-w-[260px] flex-1"
        />
        <p className="text-[13px] text-muted" aria-live="polite">
          {q ? `${fmtNum(results.length)} sonuç` : `${fmtNum(ENTRIES.length)} terim`}
        </p>
      </div>

      {!q && sections.length > 1 && (
        <nav aria-label="Harfe git" className="mt-4 flex flex-wrap gap-1">
          {sections.map(([letter]) => (
            <button
              key={letter}
              type="button"
              onClick={() => jump(letter)}
              className="grid size-8 place-items-center rounded-lg text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {letter}
            </button>
          ))}
        </nav>
      )}

      {results.length === 0 ? (
        <div className="mt-8 flex flex-col items-center py-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-subtle" aria-hidden>
            <SearchX className="size-6" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-fg">“{deferred.trim()}” için terim bulunamadı</p>
          <p className="mt-1 text-sm text-muted">Daha kısa bir kelime dene ya da İngilizce karşılığıyla ara.</p>
        </div>
      ) : q ? (
        <ul className="mt-5 grid gap-2.5 @4xl:grid-cols-2">
          {results.map((x) => (
            <Term key={x.key} e={x.e} />
          ))}
        </ul>
      ) : (
        <div className="mt-4 space-y-7">
          {sections.map(([letter, items]) => (
            <section key={letter} id={`harf-${letter}`} aria-labelledby={`harf-${letter}-h`} className="scroll-mt-4">
              <h2
                id={`harf-${letter}-h`}
                className="mb-2.5 flex items-center gap-3 text-[22px] font-semibold tracking-[-0.02em] text-accent"
              >
                {letter}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h2>
              <ul className="grid gap-2.5 @4xl:grid-cols-2">
                {items.map((x) => (
                  <Term key={x.key} e={x.e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Term({ e }: { e: GlossaryEntry }) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{e.tr}</h3>
        {e.en && e.en !== e.tr && (
          <span lang="en" className="font-mono text-[13px] text-muted">
            {e.en}
          </span>
        )}
      </div>
      <div className="lesson-prose prose-sm mt-1.5 flex-1 text-muted" dangerouslySetInnerHTML={{ __html: e.def }} />
      {e.module && (
        <div className="mt-3">
          <ModuleChip moduleId={e.module} />
        </div>
      )}
    </li>
  );
}

export const glossaryCount = ENTRIES.length;
