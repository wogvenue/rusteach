// Shared lesson parser: Markdown + YAML interactive blocks  ->  structured lesson JSON.
// Used by build-content.mjs (app bundle) and verify-rust.mjs (compiles every snippet).
// The format is documented in CONTENT_SPEC.md.

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import * as yaml from 'js-yaml';

export const INTERACTIVE = new Set([
  'quiz', 'predict', 'compiles', 'fill', 'parsons', 'exercise', 'flashcards', 'memory', 'reflect',
]);

export const CALLOUTS = {
  tip: 'İpucu',
  info: 'Bilgi',
  warning: 'Dikkat',
  error: 'Derleyici diyor ki',
  analogy: 'Benzetme',
  ferris: 'Ferris',
  deep: 'Derinlemesine',
  remember: 'Unutma!',
};

export const KNOWN_CRATES = [
  'rand', 'serde', 'serde_json', 'tokio', 'regex', 'itertools', 'anyhow', 'thiserror',
  'rayon', 'chrono', 'futures', 'tokio_stream', 'once_cell', 'clap', 'reqwest',
];

const CODE_MODES = new Set(['run', 'norun', 'compile_fail', 'should_panic', 'ignore']);

// ---------------------------------------------------------------- helpers

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** rustdoc-style hidden lines: `# foo` / `#` are compiled but not shown. */
export function splitHidden(src) {
  const full = [];
  const display = [];
  for (const line of String(src).replace(/\r\n/g, '\n').split('\n')) {
    const m = /^(\s*)#(?: (.*)|)$/.exec(line);
    if (m) {
      full.push(m[1] + (m[2] ?? ''));
    } else {
      full.push(line);
      display.push(line);
    }
  }
  return { full: trimBlock(full.join('\n')), display: trimBlock(display.join('\n')) };
}

function trimBlock(s) {
  return s.replace(/^\s*\n/, '').replace(/\s+$/, '');
}

export function hasMain(code) {
  return /(^|\n)\s*(pub\s+)?(async\s+)?fn\s+main\s*\(/.test(code);
}

export function detectCrates(...codes) {
  const found = new Set();
  const all = codes.filter(Boolean).join('\n');
  for (const c of KNOWN_CRATES) {
    const re = new RegExp(`(^|[^A-Za-z0-9_:])${c}::|use\\s+${c}\\b|extern\\s+crate\\s+${c}\\b|#\\[${c}::`);
    if (re.test(all)) found.add(c);
  }
  // serde derive implies serde
  if (/derive\([^)]*\b(Serialize|Deserialize)\b/.test(all)) found.add('serde');
  return [...found];
}

/** The exact wrapper the app and the verifier use to attach exercise tests to learner code. */
export function wrapTests(code, tests) {
  const indented = String(tests)
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => (l.length ? '    ' + l : l))
    .join('\n');
  return `${String(code).replace(/\s+$/, '')}\n\n#[cfg(test)]\nmod rusteach_tests {\n    #[allow(unused_imports)]\n    use super::*;\n\n${indented}\n}\n`;
}

/** Normalises program output for comparisons (trailing spaces / final newlines). */
export function normalizeOutput(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

export function fillCode(code, answers) {
  return String(code).replace(/___(\d+)/g, (_, n) => answers[Number(n)] ?? `___${n}`);
}

export function countBlanks(code) {
  const ids = new Set();
  for (const m of String(code).matchAll(/___(\d+)/g)) ids.add(Number(m[1]));
  return ids;
}

function parseInfo(info) {
  const parts = String(info || '')
    .trim()
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const lang = (parts.shift() || '').toLowerCase();
  const flags = { mode: 'run', title: null, errorCode: null };
  for (const p of parts) {
    if (CODE_MODES.has(p)) flags.mode = p;
    else if (/^E\d{4}$/.test(p)) flags.errorCode = p;
    else if (p.startsWith('title=')) flags.title = p.slice(6).trim();
    else if (p === 'edition2024' || p === 'edition2021') {
      /* accepted, ignored */
    } else flags.unknown = [...(flags.unknown || []), p];
  }
  return { lang, flags };
}

// ---------------------------------------------------------------- markdown

const LANG_ALIASES = {
  rs: 'rust', sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell', console: 'shellsession',
  ps: 'powershell', ps1: 'powershell', powershell: 'powershell', cmd: 'bat', bat: 'bat',
  toml: 'toml', json: 'json', yaml: 'yaml', yml: 'yaml', c: 'c', cpp: 'cpp', 'c++': 'cpp',
  python: 'python', py: 'python', js: 'javascript', javascript: 'javascript', ts: 'typescript',
  java: 'java', go: 'go', html: 'html', diff: 'diff', text: 'text', txt: 'text', plain: 'text', '': 'text',
};
export const SHIKI_LANGS = [
  'rust', 'shell', 'shellsession', 'powershell', 'bat', 'toml', 'json', 'yaml', 'c', 'cpp',
  'python', 'javascript', 'typescript', 'java', 'go', 'html', 'diff',
];

export function createMarkdown(highlighter) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight(code, info) {
      const { lang } = parseInfo(info);
      let src = code;
      if (lang === 'rust' || lang === 'rs') src = splitHidden(code).display;
      const shikiLang = LANG_ALIASES[lang] ?? 'text';
      if (highlighter && shikiLang !== 'text') {
        try {
          return highlighter.codeToHtml(src.replace(/\n$/, ''), {
            lang: shikiLang,
            themes: { light: 'one-light', dark: 'one-dark-pro' },
            defaultColor: false,
          });
        } catch {
          /* fall through */
        }
      }
      return `<pre class="shiki plain"><code>${escapeHtml(src.replace(/\n$/, ''))}</code></pre>`;
    },
  });

  // Shiki returns a full <pre>; tell markdown-it not to wrap it again.
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const { lang, flags } = parseInfo(token.info);
    const highlighted = options.highlight(token.content, token.info, '');
    const badge =
      lang === 'rust' && flags.mode === 'compile_fail'
        ? '<span class="code-badge code-badge-fail">Derlenmez</span>'
        : lang === 'rust' && flags.mode === 'should_panic'
          ? '<span class="code-badge code-badge-panic">Panik!</span>'
          : '';
    const title = flags.title ? `<div class="code-title">${escapeHtml(flags.title)}</div>` : '';
    if (highlighted.startsWith('<pre')) {
      return `<div class="static-code" data-lang="${escapeHtml(lang || 'text')}">${title}${badge}${highlighted}</div>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  // External links open in the system browser (handled by the app); mark them.
  const defaultLinkOpen =
    md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href') || '';
    if (/^https?:\/\//.test(href)) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
      tokens[idx].attrJoin('class', 'external-link');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Tables get a scroll wrapper.
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';

  for (const [kind, label] of Object.entries(CALLOUTS)) {
    md.use(container, kind, {
      validate: (params) => new RegExp(`^${kind}(\\s+.*)?$`).test(params.trim()),
      render(tokens, idx) {
        const tok = tokens[idx];
        if (tok.nesting === 1) {
          const custom = tok.info.trim().slice(kind.length).trim();
          const titleHtml = md.renderInline(custom || label);
          if (kind === 'deep') {
            return `<details class="callout callout-deep"><summary class="callout-title">${titleHtml}</summary><div class="callout-body">\n`;
          }
          return `<div class="callout callout-${kind}"><div class="callout-title">${titleHtml}</div><div class="callout-body">\n`;
        }
        return kind === 'deep' ? '</div></details>\n' : '</div></div>\n';
      },
    });
  }
  return md;
}

// ---------------------------------------------------------------- block validation

class BlockError extends Error {}

function req(obj, key, type, ctx) {
  const v = obj?.[key];
  if (v === undefined || v === null || v === '') throw new BlockError(`${ctx}: '${key}' alanı eksik`);
  if (type === 'string' && typeof v !== 'string') {
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    throw new BlockError(`${ctx}: '${key}' metin olmalı`);
  }
  if (type === 'array' && !Array.isArray(v)) throw new BlockError(`${ctx}: '${key}' liste olmalı`);
  if (type === 'boolean' && typeof v !== 'boolean') throw new BlockError(`${ctx}: '${key}' true/false olmalı`);
  return v;
}

function opt(obj, key) {
  const v = obj?.[key];
  return v === undefined || v === null ? undefined : v;
}

function asText(v) {
  return v === undefined || v === null ? '' : String(v);
}

function parseIndentedLines(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length)
    .map((l) => {
      const spaces = l.match(/^ */)[0].length;
      return { text: l.trim(), indent: Math.floor(spaces / 4) };
    });
}

function compileRegex(list, ctx, key) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new BlockError(`${ctx}: '${key}' liste olmalı`);
  return list.map((r, i) => {
    if (!r || typeof r.pattern !== 'string') throw new BlockError(`${ctx}: ${key}[${i}].pattern eksik`);
    try {
      new RegExp(r.pattern);
    } catch (e) {
      throw new BlockError(`${ctx}: ${key}[${i}] geçersiz regex: ${e.message}`);
    }
    return { pattern: r.pattern, message: asText(r.message || 'Bu kural ihlal edildi.') };
  });
}

function buildInteractive(type, data, id, md, ctx) {
  const html = (s) => (s === undefined || s === null || s === '' ? '' : md.render(String(s)));
  const inline = (s) => md.renderInline(String(s ?? ''));

  switch (type) {
    case 'quiz': {
      const question = req(data, 'question', 'string', ctx);
      const options = req(data, 'options', 'array', ctx).map(asText);
      if (options.length < 2) throw new BlockError(`${ctx}: en az 2 seçenek olmalı`);
      let answer = req(data, 'answer', null, ctx);
      const multi = Array.isArray(answer);
      answer = (multi ? answer : [answer]).map(Number);
      for (const a of answer)
        if (!Number.isInteger(a) || a < 0 || a >= options.length)
          throw new BlockError(`${ctx}: answer (${a}) seçenek aralığı dışında`);
      const feedback = opt(data, 'feedback');
      if (feedback && (!Array.isArray(feedback) || feedback.length !== options.length))
        throw new BlockError(`${ctx}: feedback listesi seçeneklerle aynı uzunlukta olmalı`);
      return {
        type, id,
        question: html(question),
        options: options.map(inline),
        answer, multi,
        explanation: html(req(data, 'explanation', 'string', ctx)),
        feedback: feedback ? feedback.map((f) => inline(asText(f))) : undefined,
      };
    }
    case 'predict': {
      const { full, display } = splitHidden(req(data, 'code', 'string', ctx));
      const options = opt(data, 'options');
      const out = {
        type, id,
        question: html(asText(opt(data, 'question') ?? 'Bu kod ne yazdırır?')),
        code: full, display,
        explanation: html(req(data, 'explanation', 'string', ctx)),
        crates: detectCrates(full),
      };
      if (options) {
        if (!Array.isArray(options) || options.length < 2) throw new BlockError(`${ctx}: options en az 2 olmalı`);
        out.options = options.map((o) => normalizeOutput(asText(o)));
        const a = Number(req(data, 'answer', null, ctx));
        if (!Number.isInteger(a) || a < 0 || a >= options.length) throw new BlockError(`${ctx}: answer aralık dışında`);
        out.answer = a;
        if (new Set(out.options).size !== out.options.length) throw new BlockError(`${ctx}: seçenekler birbirinden farklı olmalı`);
      } else {
        out.output = normalizeOutput(req(data, 'output', 'string', ctx));
      }
      return out;
    }
    case 'compiles': {
      const { full, display } = splitHidden(req(data, 'code', 'string', ctx));
      const answer = req(data, 'answer', 'boolean', ctx);
      const error = opt(data, 'error');
      if (error && !/^E\d{4}$/.test(String(error))) throw new BlockError(`${ctx}: error E0000 biçiminde olmalı`);
      if (error && answer) throw new BlockError(`${ctx}: answer true iken error verilemez`);
      return {
        type, id, code: full, display, answer,
        error: error ? String(error) : undefined,
        question: html(asText(opt(data, 'question') ?? 'Bu kod derlenir mi?')),
        explanation: html(req(data, 'explanation', 'string', ctx)),
        crates: detectCrates(full),
      };
    }
    case 'fill': {
      const code = req(data, 'code', 'string', ctx).replace(/\s+$/, '');
      const blanks = req(data, 'blanks', 'array', ctx).map((b, i) => {
        const arr = Array.isArray(b) ? b : [b];
        if (!arr.length) throw new BlockError(`${ctx}: blanks[${i}] boş`);
        return arr.map(asText);
      });
      const ids = countBlanks(code);
      for (let i = 0; i < blanks.length; i++)
        if (!ids.has(i)) throw new BlockError(`${ctx}: kodda ___${i} yok ama blanks[${i}] verilmiş`);
      for (const n of ids) if (n >= blanks.length) throw new BlockError(`${ctx}: ___${n} için cevap yok`);
      const output = opt(data, 'output');
      return {
        type, id,
        prompt: html(asText(opt(data, 'prompt') ?? 'Boşlukları doldur.')),
        code, blanks,
        output: output !== undefined ? normalizeOutput(asText(output)) : undefined,
        explanation: html(req(data, 'explanation', 'string', ctx)),
        crates: detectCrates(code),
      };
    }
    case 'parsons': {
      const lines = parseIndentedLines(req(data, 'lines', 'string', ctx));
      if (lines.length < 3) throw new BlockError(`${ctx}: en az 3 satır olmalı`);
      const distractors = parseIndentedLines(opt(data, 'distractors'));
      const verify = opt(data, 'verify');
      return {
        type, id,
        prompt: html(req(data, 'prompt', 'string', ctx)),
        lines, distractors,
        explanation: html(asText(opt(data, 'explanation'))),
        verify: verify === false ? false : true,
        source: String(data.lines).replace(/\s+$/, ''),
      };
    }
    case 'exercise': {
      const check = asText(opt(data, 'check') ?? 'tests');
      if (!['tests', 'output', 'run'].includes(check)) throw new BlockError(`${ctx}: check tests|output|run olmalı`);
      const starter = req(data, 'starter', 'string', ctx).replace(/\s+$/, '') + '\n';
      const solution = req(data, 'solution', 'string', ctx).replace(/\s+$/, '') + '\n';
      const tests = check === 'tests' ? req(data, 'tests', 'string', ctx) : asText(opt(data, 'tests'));
      const expectedOutput =
        check === 'output' ? normalizeOutput(req(data, 'expected_output', 'string', ctx)) : undefined;
      const hints = req(data, 'hints', 'array', ctx).map((h) => html(asText(h)));
      const difficulty = Number(opt(data, 'difficulty') ?? 2);
      if (!(difficulty >= 1 && difficulty <= 5)) throw new BlockError(`${ctx}: difficulty 1-5 olmalı`);
      const sc = opt(data, 'starter_compiles');
      return {
        type,
        id: opt(data, 'id') ? String(data.id) : id,
        title: req(data, 'title', 'string', ctx),
        difficulty,
        prompt: html(req(data, 'prompt', 'string', ctx)),
        starter, solution, check,
        tests: tests ? tests.replace(/\s+$/, '') : undefined,
        expectedOutput,
        hints,
        forbid: compileRegex(opt(data, 'forbid'), ctx, 'forbid'),
        require: compileRegex(opt(data, 'require'), ctx, 'require'),
        explanation: html(req(data, 'explanation', 'string', ctx)),
        starterCompiles: sc === false ? false : true,
        crates: detectCrates(solution, tests),
      };
    }
    case 'flashcards': {
      const cards = Array.isArray(data) ? data : data?.cards;
      if (!Array.isArray(cards) || !cards.length) throw new BlockError(`${ctx}: kart listesi boş`);
      return {
        type, id,
        cards: cards.map((c, i) => {
          if (!c || c.front === undefined || c.back === undefined)
            throw new BlockError(`${ctx}: kart ${i + 1} için front/back eksik`);
          return { id: `${id}-${i + 1}`, front: html(asText(c.front)), back: html(asText(c.back)) };
        }),
      };
    }
    case 'memory': {
      const rawSteps = Array.isArray(data?.steps) ? data.steps : [data];
      const steps = rawSteps.map((s, si) => {
        const stack = (s?.stack ?? []).map((f, fi) => {
          if (!f || !Array.isArray(f.vars)) throw new BlockError(`${ctx}: adım ${si + 1}, stack[${fi}].vars eksik`);
          return {
            frame: asText(f.frame ?? 'main'),
            vars: f.vars.map((v) => {
              if (!v || v.name === undefined) throw new BlockError(`${ctx}: adım ${si + 1}: değişken adı eksik`);
              return {
                name: asText(v.name), value: asText(v.value), type: v.type ? asText(v.type) : undefined,
                to: v.to ? asText(v.to) : undefined, moved: !!v.moved, mut: !!v.mut,
                note: v.note ? inline(asText(v.note)) : undefined,
              };
            }),
          };
        });
        const heap = (s?.heap ?? []).map((h) => {
          if (!h || h.id === undefined) throw new BlockError(`${ctx}: adım ${si + 1}: heap id eksik`);
          return {
            id: asText(h.id), value: asText(h.value), label: h.label ? asText(h.label) : undefined,
            freed: !!h.freed, to: h.to ? asText(h.to) : undefined,
          };
        });
        const targets = new Set([...heap.map((h) => h.id), ...stack.flatMap((f) => f.vars.map((v) => v.name))]);
        for (const f of stack)
          for (const v of f.vars)
            if (v.to && !targets.has(v.to))
              throw new BlockError(`${ctx}: adım ${si + 1}: '${v.name}' -> '${v.to}' hedefi bulunamadı`);
        return { caption: s?.caption ? inline(asText(s.caption)) : '', stack, heap };
      });
      return { type, id, title: data?.title ? inline(asText(data.title)) : '', steps };
    }
    case 'reflect':
      return {
        type, id,
        prompt: html(req(data, 'prompt', 'string', ctx)),
        answer: html(req(data, 'answer', 'string', ctx)),
      };
    default:
      throw new BlockError(`${ctx}: bilinmeyen blok tipi '${type}'`);
  }
}

// ---------------------------------------------------------------- lesson parsing

/**
 * Parse one lesson / boss / summary markdown file.
 * @returns {{ lesson: object, errors: {line:number,message:string}[], warnings: {line:number,message:string}[] }}
 */
export function parseLesson(raw, { file = '?', md, kind = 'lesson' } = {}) {
  const errors = [];
  const warnings = [];
  const src = String(raw).replace(/\r\n/g, '\n');
  let fm;
  try {
    fm = matter(src);
  } catch (e) {
    return { lesson: null, errors: [{ line: 1, message: `Front matter YAML hatası: ${e.message}` }], warnings };
  }
  const offset = src.split('\n').length - fm.content.split('\n').length;
  const meta = fm.data || {};
  const lessonId = String(meta.id ?? '');
  if (kind !== 'summary') {
    if (!lessonId) errors.push({ line: 1, message: "front matter: 'id' eksik" });
    if (!meta.title) errors.push({ line: 1, message: "front matter: 'title' eksik" });
  }

  const tokens = md.parse(fm.content, {});
  const steps = [];
  let current = { title: '', titleHtml: '', blocks: [] };
  let buffer = [];
  const counters = {};
  const stats = { checks: 0, exercises: 0, flashcards: 0, runnable: 0, reflect: 0, analogy: 0, memory: 0 };

  const flush = () => {
    if (!buffer.length) return;
    const htmlOut = md.renderer.render(buffer, md.options, {});
    if (htmlOut.trim()) current.blocks.push({ type: 'md', html: htmlOut });
    buffer = [];
  };
  const nextId = (type) => {
    counters[type] = (counters[type] || 0) + 1;
    return `${lessonId || 'x'}-${type}-${counters[type]}`;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const line = (t.map?.[0] ?? 0) + offset + 1;

    if (t.type === 'container_analogy_open') stats.analogy++;

    if (t.level === 0 && t.type === 'heading_open' && t.tag === 'h2' && kind !== 'summary') {
      flush();
      if (current.blocks.length || current.title) steps.push(current);
      const inlineTok = tokens[i + 1];
      const title = inlineTok?.content ?? '';
      current = { title, titleHtml: md.renderInline(title), blocks: [] };
      i += 2; // skip inline + heading_close
      continue;
    }

    if (t.type === 'fence') {
      const { lang, flags } = parseInfo(t.info);
      if (t.level === 0 && INTERACTIVE.has(lang) && kind !== 'summary') {
        flush();
        const id = nextId(lang);
        const ctx = `${lang} (satır ${line})`;
        let data;
        try {
          data = yaml.load(t.content);
        } catch (e) {
          const yl = e.mark ? line + 1 + e.mark.line : line;
          errors.push({
            line: yl,
            message:
              `${lang} bloğu (satır ${line}): YAML ayrıştırılamadı, sorunlu satır ${yl}, ${e.reason || e.message.split('\n')[0]}. ` +
              "İpucu: ': ' içeren ya da tırnak/backtick ile başlayan metinleri tırnakla ya da '|' blok skaleriyle yaz.",
          });
          continue;
        }
        try {
          const block = buildInteractive(lang, data, id, md, ctx);
          block.line = line;
          current.blocks.push(block);
          if (['quiz', 'predict', 'compiles', 'fill', 'parsons'].includes(lang)) stats.checks++;
          if (lang === 'exercise') stats.exercises++;
          if (lang === 'flashcards') stats.flashcards += block.cards.length;
          if (lang === 'reflect') stats.reflect++;
          if (lang === 'memory') stats.memory++;
        } catch (e) {
          errors.push({ line, message: e instanceof BlockError ? e.message : `${ctx}: ${e.message}` });
        }
        continue;
      }
      if (INTERACTIVE.has(lang) && t.level > 0) {
        errors.push({ line, message: `'${lang}' bloğu bir callout içinde olamaz` });
      }
      if ((lang === 'rust' || lang === 'rs') && flags.unknown?.length) {
        warnings.push({ line, message: `bilinmeyen rust bayrağı: ${flags.unknown.join(', ')}` });
      }
      if (t.level === 0 && (lang === 'rust' || lang === 'rs') && kind !== 'summary') {
        flush();
        const { full, display } = splitHidden(t.content);
        const lib = !hasMain(full);
        current.blocks.push({
          type: 'code',
          id: nextId('code'),
          lang: 'rust',
          code: full,
          display,
          mode: flags.mode,
          isLib: lib,
          title: flags.title ?? undefined,
          errorCode: flags.errorCode ?? undefined,
          crates: detectCrates(full),
          line,
        });
        if (flags.mode === 'run' && !lib) stats.runnable++;
        continue;
      }
    }
    buffer.push(t);
  }
  flush();
  if (current.blocks.length || current.title) steps.push(current);

  // Collect static rust code (summary files and code inside callouts) for verification.
  const staticRust = [];
  for (const t of tokens) {
    if (t.type !== 'fence') continue;
    const { lang, flags } = parseInfo(t.info);
    if (lang !== 'rust' && lang !== 'rs') continue;
    if (kind !== 'summary' && t.level === 0) continue; // handled as code blocks
    const { full } = splitHidden(t.content);
    staticRust.push({
      code: full, mode: flags.mode, errorCode: flags.errorCode, isLib: !hasMain(full),
      crates: detectCrates(full), line: (t.map?.[0] ?? 0) + offset + 1,
    });
  }

  const type = String(meta.type ?? (kind === 'boss' ? 'boss' : 'lesson'));
  if (kind !== 'summary') {
    if (!['lesson', 'project', 'boss'].includes(type)) errors.push({ line: 1, message: `type '${type}' geçersiz` });
    if (type !== 'boss') {
      if (!Array.isArray(meta.objectives) || meta.objectives.length < 1)
        warnings.push({ line: 1, message: 'objectives (öğrenme hedefleri) eksik' });
      if (stats.checks < 3) warnings.push({ line: 1, message: `en az 3 kontrol sorusu olmalı (şu an ${stats.checks})` });
      if (stats.flashcards < 4 || stats.flashcards > 10)
        warnings.push({ line: 1, message: `4-8 flashcard önerilir (şu an ${stats.flashcards})` });
      if (stats.reflect < 1) warnings.push({ line: 1, message: 'reflect bloğu yok' });
      if (stats.runnable < 2) warnings.push({ line: 1, message: `en az 2 çalıştırılabilir rust örneği önerilir (şu an ${stats.runnable})` });
      if (stats.exercises < 1) warnings.push({ line: 1, message: 'exercise yok (sadece kavramsal derslerde kabul edilir)' });
      if (stats.analogy < 1) warnings.push({ line: 1, message: 'analogy callout yok' });
    } else {
      const scored = stats.checks + stats.exercises;
      if (scored < 10) warnings.push({ line: 1, message: `boss en az 10 puanlı öğe içermeli (şu an ${scored})` });
      if (stats.exercises < 2) warnings.push({ line: 1, message: `boss en az 2 exercise içermeli (şu an ${stats.exercises})` });
      if (stats.flashcards) warnings.push({ line: 1, message: 'boss içinde flashcard olmamalı' });
    }
    if (steps.length < 2) warnings.push({ line: 1, message: `adım (## başlık) sayısı çok az: ${steps.length}` });
    // duplicate exercise ids
    const seen = new Set();
    for (const s of steps)
      for (const b of s.blocks)
        if (b.id) {
          if (seen.has(b.id)) errors.push({ line: b.line ?? 1, message: `tekrarlanan id: ${b.id}` });
          seen.add(b.id);
        }
  }

  const lesson = {
    id: lessonId,
    title: String(meta.title ?? ''),
    minutes: Number(meta.minutes ?? (kind === 'boss' ? 20 : 12)),
    type,
    objectives: (meta.objectives ?? []).map((o) => md.renderInline(String(o))),
    keywords: (meta.keywords ?? []).map(String),
    steps,
    stats,
    staticRust,
    file,
  };
  if (kind === 'summary') {
    lesson.html = md.render(fm.content);
  }
  return { lesson, errors, warnings };
}
