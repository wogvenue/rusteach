// Renders rustc / cargo / runtime output with highlighting: error/warning/help/note lines, `-->`
// locations, gutter + carets, panics, test results; E0xxx codes become chips with an explanation popover.
import { useCallback, useState, type ReactNode } from 'react';
import ErrorCodePopover from './ErrorCodePopover';

type ChipFn = (code: string, key: string) => ReactNode;

const CODE_RE = /(E\d{4})/g;

function withChips(text: string, chip: ChipFn, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(CODE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    out.push(chip(m[1], `${keyBase}-c${i++}`));
    last = idx + m[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Colors an annotation gutter line body: ^^^ primary (red), --- secondary (blue), | continuation. */
function annotation(rest: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let lastKind: 'caret' | 'dash' | null = null;
  let buf = '';
  let n = 0;
  const flush = () => {
    if (!buf) return;
    const cls = lastKind === 'caret' ? 'out-caret' : lastKind === 'dash' ? 'out-caret-2' : undefined;
    out.push(
      <span key={`${key}-t${n++}`} className={cls} style={cls ? { fontWeight: 500 } : undefined}>
        {buf}
      </span>,
    );
    buf = '';
  };
  while (i < rest.length) {
    const ch = rest[i];
    const prev = i === 0 ? ' ' : rest[i - 1];
    if (ch === '^') {
      flush();
      let j = i;
      while (rest[j] === '^') j++;
      out.push(
        <span key={`${key}-c${n++}`} className="out-caret">
          {rest.slice(i, j)}
        </span>,
      );
      lastKind = 'caret';
      i = j;
      continue;
    }
    if (ch === '-' && /\s/.test(prev) && (rest[i + 1] === '-' || /\s|$/.test(rest[i + 1] ?? ''))) {
      flush();
      let j = i;
      while (rest[j] === '-') j++;
      out.push(
        <span key={`${key}-d${n++}`} className="out-caret-2">
          {rest.slice(i, j)}
        </span>,
      );
      lastKind = 'dash';
      i = j;
      continue;
    }
    if (ch === '|') {
      flush();
      out.push(
        <span key={`${key}-g${n++}`} className="out-gutter">
          |
        </span>,
      );
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function renderLine(line: string, key: string, chip: ChipFn, state: { panic: boolean }): ReactNode {
  let m: RegExpExecArray | null;

  // error[E0382]: message  /  warning: message
  if ((m = /^(error|warning)(?:\[([A-Za-z0-9_:]+)\])?:(.*)$/.exec(line))) {
    const cls = m[1] === 'error' ? 'out-error' : 'out-warning';
    const code = m[2];
    return (
      <span className="out-line" key={key}>
        <span className={cls}>{m[1]}</span>
        {code && (
          <>
            <span className={cls}>[</span>
            {/^E\d{4}$/.test(code) ? chip(code, `${key}-h`) : <span className={cls}>{code}</span>}
            <span className={cls}>]</span>
          </>
        )}
        <span className={cls}>:</span>
        <span className="out-msg">{withChips(m[3], chip, key)}</span>
      </span>
    );
  }

  // --> src/main.rs:4:23
  if ((m = /^(\s*)-->\s*(.*)$/.exec(line))) {
    return (
      <span className="out-line" key={key}>
        <span className="out-gutter">{m[1]}--&gt; </span>
        <span className="out-loc-path">{m[2]}</span>
      </span>
    );
  }

  // note: run with `RUST_BACKTRACE=1` ...
  if (/^note: run with `RUST_BACKTRACE/.test(line)) {
    return (
      <span className="out-line out-dim" key={key}>
        {line}
      </span>
    );
  }

  // = help: ... / help: ... / = note: ... / note: ...
  if ((m = /^(\s*)(=\s*)?(help|note)(:)(.*)$/.exec(line))) {
    const cls = m[3] === 'help' ? 'out-help' : 'out-note';
    return (
      <span className="out-line" key={key}>
        {m[1]}
        {m[2] && <span className="out-gutter">{m[2]}</span>}
        <span className={cls} style={{ fontWeight: 600 }}>
          {m[3]}
          {m[4]}
        </span>
        <span>{withChips(m[5], chip, key)}</span>
      </span>
    );
  }

  // gutter lines: "2 |     code"  or  "  |   ^^^ label"
  if ((m = /^(\s*)(\d+)?(\s*)\|(.*)$/.exec(line)) && (m[2] || m[1].length > 0 || m[4].length === 0 || /^[\s|^-]/.test(m[4]))) {
    const num = m[2];
    if (num) {
      return (
        <span className="out-line" key={key}>
          <span className="out-gutter">
            {m[1]}
            {num}
            {m[3]}|
          </span>
          <span>{m[4]}</span>
        </span>
      );
    }
    return (
      <span className="out-line" key={key}>
        <span className="out-gutter">
          {m[1]}
          {m[3]}|
        </span>
        {annotation(m[4], key)}
      </span>
    );
  }

  // thread 'main' panicked at src/main.rs:4:5:
  if (/^thread '.*' panicked at/.test(line)) {
    state.panic = true;
    return (
      <span className="out-line out-panic" key={key}>
        {line}
      </span>
    );
  }
  if (state.panic && line.trim()) {
    state.panic = false;
    return (
      <span className="out-line out-msg" key={key}>
        {line}
      </span>
    );
  }

  // For more information about this error, try `rustc --explain E0382`.
  if (/^(For more information about|Some errors have detailed explanations)/.test(line)) {
    return (
      <span className="out-line out-dim" key={key}>
        {withChips(line, chip, key)}
      </span>
    );
  }

  // cargo test lines
  if ((m = /^(test \S+ \.\.\. )(ok|FAILED|ignored)$/.exec(line))) {
    return (
      <span className="out-line" key={key}>
        {m[1]}
        <span className={m[2] === 'ok' ? 'out-help' : m[2] === 'FAILED' ? 'out-error' : 'out-dim'} style={{ fontWeight: 700 }}>
          {m[2]}
        </span>
      </span>
    );
  }
  if ((m = /^(test result: )(ok|FAILED)(\..*)$/.exec(line))) {
    return (
      <span className="out-line" key={key}>
        {m[1]}
        <span className={m[2] === 'ok' ? 'out-help' : 'out-error'} style={{ fontWeight: 700 }}>
          {m[2]}
        </span>
        {m[3]}
      </span>
    );
  }

  return (
    <span className="out-line" key={key}>
      {line}
    </span>
  );
}

export default function CompilerText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState<{ code: string; el: HTMLElement } | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const chip: ChipFn = (code, key) => (
    <button
      key={key}
      type="button"
      className="err-chip font-mono"
      aria-haspopup="dialog"
      aria-expanded={open?.code === code}
      title={`${code} nedir?`}
      onClick={(e) => {
        const el = e.currentTarget;
        setOpen((o) => (o && o.el === el ? null : { code, el }));
      }}
    >
      {code}
    </button>
  );

  const state = { panic: false };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return (
    <>
      <pre className={className}>{lines.map((l, i) => renderLine(l, `l${i}`, chip, state))}</pre>
      {open && <ErrorCodePopover code={open.code} anchor={open.el} onClose={close} />}
    </>
  );
}
