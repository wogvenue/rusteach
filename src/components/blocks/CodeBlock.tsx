// Runnable / editable Rust example. Hidden (rustdoc "# ") lines are compiled but not shown unless
// the learner asks; "Düzenle" opens the full program in the editor.
import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Copy, Eye, EyeOff, FileCode2, Hammer, Laptop, Pencil, Play, RotateCcw, X } from 'lucide-react';
import type { CodeBlock as CodeBlockT } from '../../types/content';
import type { BlockProps } from './types';
import CodeView from '../editor/CodeView';
import CodeEditor from '../editor/CodeEditor';
import RunOutput, { type RunExpectation } from '../editor/RunOutput';
import ErrorChip from '../editor/ErrorChip';
import { useRunner } from '../editor/useRunner';
import { copyText } from '../editor/util';
import type { RunMode } from '../../types/bridge';

/** 0-based indices of lines in `code` that are absent from `display` (rustdoc hidden lines). */
export function hiddenLineSet(code: string, display: string): Set<number> {
  const full = code.split('\n');
  const shown = display.split('\n');
  const hidden = new Set<number>();
  let j = 0;
  full.forEach((line, i) => {
    if (j < shown.length && line === shown[j]) j++;
    else hidden.add(i);
  });
  return hidden;
}

function ToolButton({
  onClick,
  icon,
  children,
  active,
  title,
  primary,
  disabled,
}: {
  onClick: () => void;
  icon: ReactNode;
  children?: ReactNode;
  active?: boolean;
  title?: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={children ? undefined : title}
      aria-pressed={active}
      disabled={disabled}
      className={clsx(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        primary
          ? 'bg-accent text-accent-fg hover:bg-accent-strong'
          : active
            ? 'bg-accent-soft text-accent'
            : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {icon}
      {children}
    </button>
  );
}

export default function CodeBlock({ block }: BlockProps<CodeBlockT>) {
  const hidden = useMemo(() => hiddenLineSet(block.code, block.display), [block.code, block.display]);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.code);
  const [copied, setCopied] = useState(false);
  const runner = useRunner();

  const canCompile = block.mode !== 'ignore';
  const runMode: RunMode | null = !canCompile
    ? null
    : block.isLib || block.mode === 'compile_fail' || block.mode === 'norun'
      ? 'compile'
      : 'run';
  const expect: RunExpectation | undefined =
    block.mode === 'compile_fail' ? 'compile_fail' : block.mode === 'should_panic' ? 'should_panic' : undefined;
  const runLabel =
    block.mode === 'compile_fail' ? 'Derlemeyi dene' : runMode === 'compile' ? 'Derle' : 'Çalıştır';
  const modified = editing && draft !== block.code;

  const run = () => {
    if (!runMode) return;
    const code = editing ? draft : block.code;
    void runner.run({ code, mode: runMode, crates: block.crates });
  };

  const copy = async () => {
    const text = editing ? draft : showHidden ? block.code : block.display;
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const startEdit = () => {
    setEditing(true);
    setShowHidden(true);
  };

  const stopEdit = () => {
    setEditing(false);
    setDraft(block.code);
    runner.clear();
  };

  return (
    <figure className="group/code relative overflow-hidden rounded-2xl border border-[var(--code-border)] bg-[var(--code-bg)]">
      <figcaption className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--code-border)] bg-[var(--code-bg-2)] py-1.5 pl-4 pr-2">
        <FileCode2 className="size-4 shrink-0 text-subtle" aria-hidden="true" />
        <span className="truncate font-mono text-xs text-muted">{block.title ?? (block.isLib ? 'lib.rs' : 'main.rs')}</span>
        {block.mode === 'compile_fail' && (
          <span className="code-badge code-badge-fail">
            <X className="size-3" strokeWidth={3} aria-hidden="true" /> Derlenmez
          </span>
        )}
        {block.mode === 'compile_fail' && block.errorCode && <ErrorChip code={block.errorCode} />}
        {block.mode === 'should_panic' && <span className="code-badge code-badge-panic">Panik!</span>}
        {block.mode === 'norun' && (
          <span
            className="code-badge code-badge-local"
            title="Bu program uygulama içinde çalıştırılmaz (girdi bekler, dosya ya da ağ kullanır veya sonsuza kadar çalışır)."
          >
            <Laptop className="size-3" aria-hidden="true" /> Yerelde çalıştır
          </span>
        )}
        {editing && (
          <span className="text-xs text-subtle" style={{ fontFamily: 'var(--font-sans)' }}>
            {modified ? 'Değiştirildi' : 'Düzenleniyor'}
          </span>
        )}
        <span className="flex-1" />
        <div className="flex items-center gap-0.5">
          {hidden.size > 0 && !editing && (
            <ToolButton
              onClick={() => setShowHidden((v) => !v)}
              active={showHidden}
              icon={showHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              title={showHidden ? 'Gizli satırları sakla' : 'Gizli satırları göster'}
            >
              <span className="hidden md:inline">{showHidden ? 'Gizli satırları sakla' : 'Gizli satırları göster'}</span>
            </ToolButton>
          )}
          <ToolButton onClick={copy} icon={copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} title="Kopyala" />
          {canCompile &&
            (editing ? (
              <>
                {modified && (
                  <ToolButton onClick={() => setDraft(block.code)} icon={<RotateCcw className="size-3.5" />} title="Sıfırla">
                    <span className="hidden sm:inline">Sıfırla</span>
                  </ToolButton>
                )}
                <ToolButton onClick={stopEdit} icon={<X className="size-3.5" />} title="Düzenlemeyi bitir" />
              </>
            ) : (
              <ToolButton onClick={startEdit} icon={<Pencil className="size-3.5" />} title="Düzenle">
                <span className="hidden sm:inline">Düzenle</span>
              </ToolButton>
            ))}
          {runMode && (
            <ToolButton
              onClick={run}
              primary
              disabled={runner.running}
              icon={runMode === 'run' ? <Play className="size-3.5" /> : <Hammer className="size-3.5" />}
              title={`${runLabel} (Ctrl+Enter)`}
            >
              {runLabel}
            </ToolButton>
          )}
        </div>
      </figcaption>

      {editing ? (
        <CodeEditor value={draft} onChange={setDraft} onRun={run} maxHeight="520px" autoFocus ariaLabel="Örnek kodu düzenle" />
      ) : (
        <CodeView
          code={showHidden ? block.code : block.display}
          hiddenLines={showHidden ? hidden : undefined}
          ariaLabel={block.title ?? 'Örnek kod'}
          className="max-h-[560px]"
        />
      )}

      {block.mode === 'norun' && (
        <p
          className="border-t border-[var(--code-border)] px-4 py-2 text-xs leading-relaxed text-muted"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Bu programı kendi bilgisayarında çalıştır: yeni bir proje için <code className="inline-code">cargo new deneme</code>,
          kodu <code className="inline-code">src/main.rs</code> dosyasına yapıştır ve <code className="inline-code">cargo run</code> komutunu
          ver. Burada yalnızca derlenip denetlenir.
        </p>
      )}

      {(runner.running || runner.result) && (
        <div className="border-t border-[var(--code-border)]">
          <RunOutput
            result={runner.result}
            running={runner.running}
            mode={runner.mode}
            startedAt={runner.startedAt}
            expect={editing && modified ? undefined : expect}
            expectedError={block.errorCode}
            onClose={runner.clear}
          />
        </div>
      )}
    </figure>
  );
}
