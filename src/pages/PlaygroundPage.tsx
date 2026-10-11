// /oyun-alani - free Rust playground: snippets as tabs, templates, run / test / compile, stdin
// (local backend only) and copy-to-share.
import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { Copy, FlaskConical, FolderOpen, Hammer, Play, Save } from 'lucide-react';
import CodeEditor from '../components/editor/CodeEditor';
import { useRunner } from '../components/editor/useRunner';
import { copyText, detectCrates } from '../components/editor/util';
import SnippetTabs from '../components/editor/playground/SnippetTabs';
import TemplatesMenu from '../components/editor/playground/TemplatesMenu';
import OutputPane from '../components/editor/playground/OutputPane';
import { clampSplit, useSnippets } from '../components/editor/playground/useSnippets';
import { hasMain } from '../lib/runner';
import { useProgress } from '../store/progress';
import { toast } from '../store/ui';
import type { RunMode } from '../types/bridge';
import '../styles/lesson.css';

function ActionButton({
  onClick,
  icon,
  label,
  title,
  primary,
  disabled,
}: {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
  title: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label ? undefined : title}
      className={clsx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45',
        primary
          ? 'bg-accent px-3.5 text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-accent-strong'
          : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default function PlaygroundPage() {
  const sn = useSnippets();
  const runner = useRunner();
  const backendPref = useProgress((s) => s.settings.runner);
  const electron = typeof window !== 'undefined' && !!window.rusteach;
  const stdinAvailable = electron && backendPref !== 'online';
  const code = sn.active.code;
  const crates = useMemo(() => detectCrates(code), [code]);
  const lib = !hasMain(code);
  const hasTests = /#\[(tokio::)?test\]/.test(code);
  const split = useRef<HTMLDivElement>(null);

  const run = useCallback(
    (mode: RunMode) => {
      if (runner.running) return;
      if (mode === 'run' && lib) mode = 'compile';
      void runner.run({ code, mode, crates, stdin: stdinAvailable && sn.stdin ? sn.stdin : undefined });
    },
    [runner, lib, code, crates, stdinAvailable, sn.stdin],
  );

  const share = async () => {
    const ok = await copyText(code);
    toast(
      ok
        ? { kind: 'success', title: 'Kod panoya kopyalandı', description: 'İstediğin yere yapıştırıp paylaşabilirsin.', duration: 2200 }
        : { kind: 'error', title: 'Kopyalanamadı', description: 'Kodu seçip Ctrl+C ile kopyalayabilirsin.' },
    );
  };

  const save = async () => {
    if (!window.rusteach) return;
    const ok = await window.rusteach.saveTextFile(sn.active.name, code);
    if (ok) toast({ kind: 'success', title: 'Dosya kaydedildi', description: sn.active.name, duration: 2200 });
  };

  const open = async () => {
    if (!window.rusteach) return;
    const text = await window.rusteach.openTextFile();
    if (text !== null) sn.add('acilan.rs', text);
  };

  // draggable divider between editor and output
  const onDividerDown = (e: PointerEvent<HTMLDivElement>) => {
    const box = split.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => sn.setSplit((ev.clientX - box.left) / box.width);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onDividerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      sn.setSplit(clampSplit(sn.split + (e.key === 'ArrowLeft' ? -0.04 : 0.04)));
    }
  };

  const runLabel = lib ? 'Derle' : 'Çalıştır';

  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-5">
      <h1 className="sr-only">Oyun alanı</h1>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--code-border)] bg-[var(--code-bg-2)] shadow-card">
        <div className="flex shrink-0 items-end gap-2 border-b border-[var(--code-border)] pr-2">
          <SnippetTabs
            snippets={sn.snippets}
            activeId={sn.activeId}
            onSelect={(id) => {
              sn.select(id);
              runner.clear();
            }}
            onClose={sn.close}
            onRename={sn.rename}
            onAdd={() => sn.add('yeni.rs', 'fn main() {\n    \n}\n')}
          />
          <div className="flex shrink-0 items-center gap-0.5 pb-1.5">
            <TemplatesMenu
              onPick={(t) => {
                sn.add(t.name, t.code);
                runner.clear();
              }}
            />
            {electron && <ActionButton onClick={open} icon={<FolderOpen className="size-3.5" />} title="Dosya aç" />}
            {electron && <ActionButton onClick={save} icon={<Save className="size-3.5" />} title="Dosyaya kaydet" />}
            <ActionButton onClick={share} icon={<Copy className="size-3.5" />} title="Kodu panoya kopyala" label="Paylaş" />
            <span className="mx-1.5 h-5 w-px bg-[var(--code-border)]" aria-hidden="true" />
            {/* without fn main the primary button already compiles */}
            {!lib && (
              <ActionButton
                onClick={() => run('compile')}
                disabled={runner.running}
                icon={<Hammer className="size-3.5" />}
                title="Yalnızca derle ve denetle"
                label="Derle"
              />
            )}
            <ActionButton
              onClick={() => run('test')}
              disabled={runner.running || !hasTests}
              icon={<FlaskConical className="size-3.5" />}
              title={hasTests ? 'Testleri çalıştır (Ctrl+Shift+Enter)' : 'Bu dosyada #[test] fonksiyonu yok'}
              label="Test"
            />
            <ActionButton
              onClick={() => run('run')}
              disabled={runner.running}
              primary
              icon={lib ? <Hammer className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
              title={`${runLabel} (Ctrl+Enter)`}
              label={runLabel}
            />
          </div>
        </div>

        <div
          ref={split}
          className="grid min-h-0 flex-1"
          style={{ gridTemplateColumns: `minmax(0, ${sn.split}fr) 6px minmax(0, ${1 - sn.split}fr)` }}
        >
          <div className="flex min-h-0 min-w-0 flex-col bg-[var(--code-bg)]">
            <div className="min-h-0 flex-1 overflow-hidden">
              <CodeEditor
                key={sn.activeId}
                value={code}
                onChange={sn.setCode}
                onRun={() => run('run')}
                onSecondary={() => hasTests && run('test')}
                height="100%"
                className="h-full [&_.cm-theme]:h-full"
                ariaLabel={`${sn.active.name} kod editörü`}
                autoFocus
              />
            </div>
            <div className="flex h-8 shrink-0 items-center gap-3 border-t border-[var(--code-border)] px-4 text-[0.72rem] text-subtle">
              <span className="truncate">
                {lib ? 'fn main yok, kütüphane olarak derlenir' : 'Ctrl+Enter çalıştırır'}
                {hasTests && ', Ctrl+Shift+Enter test eder'}
              </span>
              <span className="flex-1" />
              {crates.length > 0 && (
                <span className="flex items-center gap-1 truncate" title="Kodunda kullanılan dış crate'ler">
                  crate:
                  {crates.map((c) => (
                    <span key={c} className="rounded bg-info-soft px-1.5 py-px font-mono font-semibold text-info">
                      {c}
                    </span>
                  ))}
                </span>
              )}
              <span className="font-mono tabular-nums">{code.split('\n').length} satır</span>
            </div>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Editör ile çıktı arasındaki ayırıcı"
            aria-valuemin={30}
            aria-valuemax={75}
            aria-valuenow={Math.round(sn.split * 100)}
            tabIndex={0}
            onPointerDown={onDividerDown}
            onKeyDown={onDividerKey}
            onDoubleClick={() => sn.setSplit(0.58)}
            className="group/div relative cursor-col-resize bg-[var(--code-bg)] outline-none"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--code-border)]" />
            <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover/div:opacity-60 group-focus-visible/div:opacity-100" />
          </div>

          <OutputPane
            runner={runner}
            hasTests={hasTests}
            onClear={runner.clear}
            stdin={sn.stdin}
            onStdin={sn.setStdin}
            stdinAvailable={stdinAvailable}
          />
        </div>
      </div>
    </div>
  );
}
