// Lightweight read-only Rust code view (no editor instance). Shares the editor's syntax palette.
// Usable from any page: <CodeView code={src} />.
import { Fragment, useMemo, type ReactNode } from 'react';
import clsx from 'clsx';
import { highlightRust } from './highlight';
import { useProgress } from '../../store/progress';
import '../../styles/lesson.css';

export interface CodeViewProps {
  code: string;
  lineNumbers?: boolean;
  /** 0-based line indices drawn dimmed (rustdoc hidden lines). */
  hiddenLines?: ReadonlySet<number>;
  /** 0-based line indices drawn with an accent marker. */
  markLines?: ReadonlySet<number>;
  /** Custom renderer for `___N` placeholders (used by fill-in-the-blank). */
  renderBlank?: (index: number, key: string) => ReactNode;
  /** Font size override in px (defaults to the editor font size setting). */
  fontSize?: number;
  className?: string;
  ariaLabel?: string;
}

const BLANK = /(___\d+)/;

export default function CodeView({
  code,
  lineNumbers = true,
  hiddenLines,
  markLines,
  renderBlank,
  fontSize,
  className,
  ariaLabel,
}: CodeViewProps) {
  const settingSize = useProgress((s) => s.settings.editorFontSize);
  const lines = useMemo(() => highlightRust(code), [code]);
  const lnChars = String(lines.length).length;

  return (
    <div
      className={clsx('code-view', !lineNumbers && 'no-ln', className)}
      style={{ fontSize: fontSize ?? Math.max(12, settingSize - 0.5), ['--ln-chars' as string]: lnChars }}
      role="region"
      aria-label={ariaLabel ?? 'Kod'}
      tabIndex={0}
    >
      <pre>
        <code>
          {lines.map((tokens, i) => (
            <span
              key={i}
              className={clsx('cv-line', hiddenLines?.has(i) && 'cv-line-hidden', markLines?.has(i) && 'cv-line-mark')}
            >
              {lineNumbers && (
                <span className="cv-ln" aria-hidden="true">
                  {i + 1}
                </span>
              )}
              <span className="cv-text">
                {tokens.length === 0 ? '​' : null}
                {tokens.map((tok, j) => {
                  if (!renderBlank || !BLANK.test(tok.text)) {
                    return (
                      <span key={j} className={tok.cls || undefined}>
                        {tok.text}
                      </span>
                    );
                  }
                  return (
                    <Fragment key={j}>
                      {tok.text.split(BLANK).map((part, k) => {
                        const m = /^___(\d+)$/.exec(part);
                        if (m) return <Fragment key={k}>{renderBlank(Number(m[1]), `${i}-${j}-${k}`)}</Fragment>;
                        return part ? (
                          <span key={k} className={tok.cls || undefined}>
                            {part}
                          </span>
                        ) : null;
                      })}
                    </Fragment>
                  );
                })}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
