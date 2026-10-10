// "Hata Rehberi" tab: searchable list of compiler error codes and a detail panel with the
// explanation, the failing and the fixed code, and a button that runs the failing code through
// the real compiler.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { CircleCheck, CircleX, ExternalLink, Hammer, SearchX, Wrench } from 'lucide-react';
import { Button } from '../../ui/Button';
import SearchField from './SearchField';
import ModuleChip from './ModuleChip';
import CodeView from '../../editor/CodeView';
import RunOutput from '../../editor/RunOutput';
import { useRunner } from '../../editor/useRunner';
import { content } from '../../../lib/content';
import { openExternal } from '../toolchain';
import { prefersReducedMotion } from '../../ui/motion';
import { fold, fmtNum, stripHtml } from '../turkish';
import type { ErrorEntry } from '../../../types/content';
import '../../../styles/lesson.css';

const ERRORS: ErrorEntry[] = [...content.reference.errors].sort((a, b) => a.code.localeCompare(b.code));

/** Entries still waiting for their Turkish text carry a placeholder; treat it as missing. */
const isPlaceholder = (html: string) => !stripHtml(html) || /yazılacak/i.test(stripHtml(html));
const hasTitle = (e: ErrorEntry) => !!e.title && e.title !== e.code;

export function findError(code: string | null): ErrorEntry | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  return ERRORS.find((e) => e.code === c);
}

export const errorCount = ERRORS.length;

export default function ErrorGuide({ selected, onSelect }: { selected: string | null; onSelect: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const q = fold(deferred.trim());

  const results = useMemo(() => {
    if (!q) return ERRORS;
    const compact = q.replace(/\s+/g, '');
    return ERRORS.filter((e) => {
      const code = fold(e.code);
      return code.includes(compact) || code.slice(1).includes(compact) || fold(e.title).includes(q) || fold(stripHtml(e.explanation)).includes(q);
    });
  }, [q]);

  const current = findError(selected) ?? results[0] ?? ERRORS[0];
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // keep the selected row visible (deep links like /sozluk?hata=E0382)
  useEffect(() => {
    // scroll only the list itself, never the page
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-code="${current?.code}"]`);
    if (!list || !row) return;
    const top = row.offsetTop;
    const margin = Math.min(120, list.clientHeight / 3);
    if (top < list.scrollTop + 4 || top + row.offsetHeight > list.scrollTop + list.clientHeight - margin)
      list.scrollTop = Math.max(0, top - margin);
  }, [current?.code]);

  if (!ERRORS.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
        Hata rehberi şu an boş. Derleyici bir hata kodu verdiğinde resmi açıklamasına çıktıdaki koda tıklayarak ulaşabilirsin.
      </p>
    );
  }

  const choose = (code: string) => {
    onSelect(code);
    // when the list sits above the detail (narrow layout), bring the detail into view
    const list = listRef.current?.getBoundingClientRect();
    const detail = detailRef.current?.getBoundingClientRect();
    if (list && detail && detail.top >= list.bottom) {
      window.setTimeout(
        () => detailRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }),
        30,
      );
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = results.findIndex((x) => x.code === current?.code);
    const next = results[Math.max(0, Math.min(results.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    onSelect(next.code);
    window.setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-code="${next.code}"]`)?.focus(), 0);
  };

  return (
    <div className="grid gap-5 @3xl:grid-cols-[260px_minmax(0,1fr)] @5xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="min-w-0 @3xl:sticky @3xl:top-4 @3xl:self-start">
        <SearchField value={query} onChange={setQuery} label="Hata kodu ya da başlık ara" placeholder="E0382, ödünç, taşınmış…" />
        <p className="mt-2 px-1 text-xs text-subtle" aria-live="polite">
          {q ? `${fmtNum(results.length)} sonuç` : `${fmtNum(ERRORS.length)} hata kodu`}
        </p>
        {results.length === 0 ? (
          <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-4 py-8 text-center">
            <SearchX className="size-6 text-subtle" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-fg">Eşleşen hata yok</p>
            <p className="mt-1 text-[13px] text-muted">Kodu E harfi olmadan da yazabilirsin: 0382</p>
          </div>
        ) : (
          <ul
            ref={listRef}
            aria-label="Hata kodları"
            onKeyDown={onListKey}
            className="relative mt-2 max-h-[280px] @3xl:max-h-[calc(100vh-190px)] space-y-0.5 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5"
          >
            {results.map((e) => {
              const active = e.code === current?.code;
              return (
                <li key={e.code}>
                  <button
                    type="button"
                    data-code={e.code}
                    aria-current={active ? 'true' : undefined}
                    tabIndex={active ? 0 : -1}
                    onClick={() => choose(e.code)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                      active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className={clsx('font-mono text-[13px] font-semibold', active ? 'text-accent' : 'text-fg')}>{e.code}</span>
                    {hasTitle(e) && <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{e.title}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div ref={detailRef} className="min-w-0 scroll-mt-4">
        {current && <ErrorDetail key={current.code} e={current} />}
      </div>
    </div>
  );
}

function ErrorDetail({ e }: { e: ErrorEntry }) {
  const bad = useRunner();
  const fixed = useRunner();
  const officialUrl = `https://doc.rust-lang.org/error_codes/${e.code}.html`;
  const explanationMissing = isPlaceholder(e.explanation);
  const fixMissing = isPlaceholder(e.fixExplanation);

  return (
    <article aria-labelledby="error-title" className="rounded-3xl border border-border bg-surface shadow-card">
      <header className="border-b border-border p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-danger-soft px-2 py-0.5 font-mono text-[13px] font-semibold text-danger">error[{e.code}]</span>
          <ModuleChip moduleId={e.module} />
        </div>
        <h2 id="error-title" className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-fg">
          {hasTitle(e) ? e.title : `Derleyici hatası ${e.code}`}
        </h2>
        {explanationMissing ? (
          <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-muted">
            Bu hatanın Türkçe açıklaması hazırlanıyor. Aşağıdaki örneği derleyicide deneyip mesajı okuyabilir, ayrıntılı
            açıklama için Rust’ın resmi hata kataloğuna bakabilirsin.
          </p>
        ) : (
          <div className="lesson-prose mt-3 max-w-[68ch] text-muted" dangerouslySetInnerHTML={{ __html: e.explanation }} />
        )}
        <button
          type="button"
          onClick={() => openExternal(officialUrl)}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
        >
          Resmi açıklama (İngilizce)
          <ExternalLink className="size-3.5" aria-hidden />
        </button>
      </header>

      <section aria-labelledby="bad-code" className="p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="bad-code" className="inline-flex items-center gap-2 text-[15px] font-semibold text-fg">
            <CircleX className="size-[18px] text-danger" aria-hidden />
            Hatalı kod
          </h3>
          <Button
            size="sm"
            icon={<Hammer className="size-4" />}
            loading={bad.running}
            onClick={() => void bad.run({ code: e.bad, mode: 'compile' })}
          >
            Derleyicide dene
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
          <CodeView code={e.bad} ariaLabel={`${e.code} hatasını veren kod`} />
          <RunOutput
            result={bad.result}
            running={bad.running}
            mode={bad.mode}
            startedAt={bad.startedAt}
            expect="compile_fail"
            expectedError={e.code}
            onClose={bad.clear}
          />
        </div>
        {!bad.result && !bad.running && (
          <p className="mt-2 text-xs leading-5 text-subtle">
            Kod gerçekten derlenir; derleyicinin verdiği mesajı birebir görürsün. Mesajı okumak, hatayı çözmenin yarısıdır.
          </p>
        )}
      </section>

      <section aria-labelledby="fix-code" className="border-t border-border p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="fix-code" className="inline-flex items-center gap-2 text-[15px] font-semibold text-fg">
            <CircleCheck className="size-[18px] text-success" aria-hidden />
            Düzeltilmiş kod
          </h3>
          <Button
            size="sm"
            variant="secondary"
            icon={<Hammer className="size-4" />}
            loading={fixed.running}
            onClick={() => void fixed.run({ code: e.fix, mode: 'compile' })}
          >
            Bunu da dene
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
          <CodeView code={e.fix} ariaLabel={`${e.code} için düzeltilmiş kod`} />
          <RunOutput result={fixed.result} running={fixed.running} mode={fixed.mode} startedAt={fixed.startedAt} onClose={fixed.clear} />
        </div>
        {!fixMissing && (
          <div className="mt-4 flex gap-3 rounded-2xl bg-success-soft p-4">
            <Wrench className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <div className="lesson-prose prose-sm min-w-0 text-fg" dangerouslySetInnerHTML={{ __html: e.fixExplanation }} />
          </div>
        )}
      </section>
    </article>
  );
}
