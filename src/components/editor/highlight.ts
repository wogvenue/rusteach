// One Rust syntax palette for the whole app: the CodeMirror editor and the lightweight CodeView both
// emit `tok-*` classes from this highlighter; colors live in src/styles/lesson.css (--syn-* tokens).
import { highlightCode, tagHighlighter, tags as t } from '@lezer/highlight';
import { rustLanguage } from '@codemirror/lang-rust';

export const rustHighlighter = tagHighlighter([
  { tag: [t.keyword, t.definitionKeyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], class: 'tok-kw' },
  { tag: t.modifier, class: 'tok-mod' },
  { tag: t.self, class: 'tok-self' },
  { tag: [t.string, t.special(t.string), t.character], class: 'tok-str' },
  { tag: [t.number, t.integer, t.float, t.bool], class: 'tok-num' },
  { tag: [t.function(t.variableName), t.function(t.definition(t.variableName)), t.function(t.propertyName)], class: 'tok-fn' },
  { tag: t.macroName, class: 'tok-macro' },
  { tag: [t.typeName, t.className], class: 'tok-type' },
  { tag: t.namespace, class: 'tok-ns' },
  { tag: t.propertyName, class: 'tok-prop' },
  { tag: [t.special(t.variableName), t.labelName], class: 'tok-life' },
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'tok-comment' },
  { tag: t.meta, class: 'tok-meta' },
  {
    tag: [
      t.operator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator,
      t.updateOperator, t.definitionOperator, t.derefOperator,
    ],
    class: 'tok-op',
  },
  { tag: [t.punctuation, t.separator, t.paren, t.brace, t.squareBracket], class: 'tok-punct' },
  { tag: t.variableName, class: 'tok-var' },
]);

export interface Token {
  text: string;
  cls: string;
}

const cache = new Map<string, Token[][]>();

/** Splits Rust source into highlighted lines of tokens (cached). */
export function highlightRust(code: string): Token[][] {
  const hit = cache.get(code);
  if (hit) return hit;
  const lines: Token[][] = [[]];
  try {
    const tree = rustLanguage.parser.parse(code);
    highlightCode(
      code,
      tree,
      rustHighlighter,
      (text, classes) => lines[lines.length - 1].push({ text, cls: classes }),
      () => lines.push([]),
    );
  } catch {
    lines.length = 0;
    for (const l of code.split('\n')) lines.push([{ text: l, cls: '' }]);
  }
  if (cache.size > 400) cache.clear();
  cache.set(code, lines);
  return lines;
}
