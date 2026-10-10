// CodeMirror 6 Rust editor themed from the app tokens (see --code-* / --syn-* in lesson.css).
// Tab indents; Esc then Tab leaves the editor (CodeMirror tab-focus mode). Ctrl+Enter runs `onRun`.
import { useId, useMemo, useRef } from 'react';
import CodeMirror, { EditorState, EditorView, Prec, keymap, type Extension } from '@uiw/react-codemirror';
import { rust } from '@codemirror/lang-rust';
import { indentUnit, syntaxHighlighting } from '@codemirror/language';
import clsx from 'clsx';
import { rustHighlighter } from './highlight';
import { useResolvedTheme } from './useResolvedTheme';
import { useProgress } from '../../store/progress';
import '../../styles/lesson.css';

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Primary action for Ctrl/Cmd+Enter (run / check). */
  onRun?: () => void;
  /** Ctrl/Cmd+Shift+Enter. */
  onSecondary?: () => void;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  lineNumbers?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

function buildTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { color: 'var(--code-fg)', backgroundColor: 'var(--code-bg)' },
      '.cm-content': { caretColor: 'var(--c-accent)', padding: '12px 0' },
      '.cm-line': { padding: '0 16px 0 6px' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--c-accent)', borderLeftWidth: '2px' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: 'var(--code-selection)' },
      '.cm-activeLine': { backgroundColor: 'var(--code-active-line)' },
      '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--code-gutter)', border: 'none' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--code-gutter-active)' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 14px', minWidth: '34px' },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'var(--code-bracket)',
        outline: '1px solid color-mix(in srgb, var(--c-accent) 45%, transparent)',
        borderRadius: '2px',
      },
      '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'color-mix(in srgb, var(--c-danger) 25%, transparent)' },
      '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--c-accent) 11%, transparent)' },
      '.cm-searchMatch': {
        backgroundColor: 'color-mix(in srgb, var(--c-warning) 22%, transparent)',
        outline: '1px solid color-mix(in srgb, var(--c-warning) 50%, transparent)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--c-accent) 30%, transparent)' },
      '.cm-panels': { backgroundColor: 'var(--code-bg-2)', color: 'var(--c-fg)' },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--code-border)' },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--code-border)' },
      '.cm-textfield': {
        backgroundColor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: '6px',
        color: 'var(--c-fg)',
      },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'var(--c-surface-2)',
        border: '1px solid var(--c-border)',
        borderRadius: '6px',
        color: 'var(--c-fg)',
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--c-elevated)',
        border: '1px solid var(--c-border)',
        color: 'var(--c-fg)',
        borderRadius: '8px',
      },
    },
    { dark },
  );
}

const darkTheme = buildTheme(true);
const lightTheme = buildTheme(false);
const hideCursor = EditorView.theme({ '.cm-cursor': { display: 'none !important' } });

export default function CodeEditor({
  value,
  onChange,
  readOnly = false,
  onRun,
  onSecondary,
  height,
  minHeight,
  maxHeight,
  lineNumbers = true,
  autoFocus,
  placeholder,
  ariaLabel = 'Rust kod editörü',
  className,
}: CodeEditorProps) {
  const theme = useResolvedTheme();
  const fontSize = useProgress((s) => s.settings.editorFontSize);
  const runRef = useRef(onRun);
  const secondaryRef = useRef(onSecondary);
  runRef.current = onRun;
  secondaryRef.current = onSecondary;
  const hintId = useId();

  const extensions = useMemo<Extension[]>(
    () => [
      rust(),
      indentUnit.of('    '),
      EditorState.tabSize.of(4),
      syntaxHighlighting(rustHighlighter),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel, 'aria-describedby': hintId }),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (!runRef.current) return false;
              runRef.current();
              return true;
            },
          },
          {
            key: 'Mod-Shift-Enter',
            run: () => {
              if (!secondaryRef.current) return false;
              secondaryRef.current();
              return true;
            },
          },
        ]),
      ),
      ...(readOnly ? [hideCursor] : []),
    ],
    [readOnly, ariaLabel, hintId],
  );

  const basicSetup = useMemo(
    () => ({
      lineNumbers,
      foldGutter: false,
      autocompletion: false,
      syntaxHighlighting: false,
      highlightActiveLine: !readOnly,
      highlightActiveLineGutter: !readOnly,
      crosshairCursor: false,
      tabSize: 4,
    }),
    [lineNumbers, readOnly],
  );

  return (
    <div className={clsx('code-editor', className)} style={{ fontSize }}>
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={theme === 'dark' ? darkTheme : lightTheme}
        extensions={extensions}
        basicSetup={basicSetup}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
        autoFocus={autoFocus}
        placeholder={placeholder}
        indentWithTab={!readOnly}
      />
      <span id={hintId} className="sr-only">
        {readOnly
          ? 'Salt okunur kod.'
          : 'Tab girinti ekler. Editörden çıkmak için önce Esc, sonra Tab tuşuna bas. Ctrl+Enter çalıştırır.'}
      </span>
    </div>
  );
}
