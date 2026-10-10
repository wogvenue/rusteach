#!/usr/bin/env node
// Compiles / runs EVERY piece of Rust code in the content and checks it behaves as the lesson claims.
//
//   node scripts/verify-rust.mjs                    # everything (modules + reference)
//   node scripts/verify-rust.mjs m04 m05            # only these modules
//   node scripts/verify-rust.mjs --reference        # only content/reference/errors.yaml
//   node scripts/verify-rust.mjs m04 --concurrency 3 --show-warnings --no-cache
//
// Backend: local `rustc` when available (std-only code), otherwise the official Rust Playground
// (play.rust-lang.org, edition 2024). Results are cached in .cache/rust/ by code hash, and a
// cross-process semaphore (.cache/locks) keeps the total load on the Playground polite.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { createMarkdown, wrapTests, normalizeOutput, fillCode, hasMain, parseLesson } from './lib/lesson-parser.mjs';
import { loadContent, printProblems, ROOT } from './lib/content-loader.mjs';

// ------------------------------------------------------------------ args
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const val = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const CONCURRENCY = Number(val('--concurrency', '4'));
const USE_CACHE = !flag('--no-cache');
const SHOW_WARNINGS = flag('--show-warnings');
const ONLY_REFERENCE = flag('--reference');
const FORCE_PLAYGROUND = flag('--playground');
const onlyModules = argv.filter((a) => /^m?\d{1,2}$/i.test(a));
const SLOTS = Number(process.env.RUSTEACH_PLAYGROUND_SLOTS || 6);
const EDITION = '2024';

const CACHE_DIR = path.join(ROOT, '.cache', 'rust');
const LOCK_DIR = path.join(ROOT, '.cache', 'locks');
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(LOCK_DIR, { recursive: true });

// ------------------------------------------------------------------ backends
const LOCAL_RUSTC = !FORCE_PLAYGROUND && spawnSync('rustc', ['--version'], { encoding: 'utf8', shell: false }).status === 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquireSlot() {
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const p = path.join(LOCK_DIR, `slot-${i}`);
      try {
        const fd = fs.openSync(p, 'wx');
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
        return p;
      } catch {
        try {
          const age = Date.now() - fs.statSync(p).mtimeMs;
          if (age > 120_000) fs.unlinkSync(p); // stale
        } catch {
          /* gone */
        }
      }
    }
    await sleep(150 + Math.floor(Math.random() * 250));
  }
}
function releaseSlot(p) {
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

async function playground(endpoint, body) {
  let lastErr = '';
  for (let attempt = 0; attempt < 7; attempt++) {
    const slot = await acquireSlot();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(`https://play.rust-lang.org/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'rusteach-content-verifier' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
      } else {
        const j = await res.json();
        if (typeof j.success === 'boolean') return { success: j.success, stdout: j.stdout ?? '', stderr: j.stderr ?? '' };
        const msg = String(j.error ?? JSON.stringify(j));
        if (/timed out|timeout/i.test(msg)) return { success: false, stdout: '', stderr: `ZAMAN AŞIMI: ${msg}` };
        lastErr = msg;
      }
    } catch (e) {
      lastErr = e.name === 'AbortError' ? 'istek zaman aşımı' : e.message;
    } finally {
      releaseSlot(slot);
    }
    await sleep(2000 * 2 ** attempt);
  }
  return { success: false, stdout: '', stderr: `PLAYGROUND ULAŞILAMADI: ${lastErr}`, infra: true };
}

function runLocal(kind, code, { crateType, tests }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rusteach-'));
  try {
    const src = path.join(dir, 'main.rs');
    fs.writeFileSync(src, code);
    const exe = path.join(dir, process.platform === 'win32' ? 'prog.exe' : 'prog');
    const args = ['--edition', EDITION, '--crate-name', 'playground', '-o'];
    if (kind === 'compile' || (crateType === 'lib' && !tests)) {
      const c = spawnSync('rustc', [...args, path.join(dir, 'out.rmeta'), '--emit=metadata', '--crate-type', crateType, src], {
        encoding: 'utf8', timeout: 60_000,
      });
      return { success: c.status === 0, stdout: '', stderr: c.stderr ?? '' };
    }
    const c = spawnSync('rustc', [...args, exe, ...(tests ? ['--test'] : ['--crate-type', 'bin']), src], {
      encoding: 'utf8', timeout: 90_000,
    });
    if (c.status !== 0) return { success: false, stdout: '', stderr: c.stderr ?? '' };
    const r = spawnSync(exe, tests ? ['--test-threads=1'] : [], { encoding: 'utf8', timeout: 10_000 });
    return {
      success: r.status === 0,
      stdout: r.stdout ?? '',
      stderr: (c.stderr ?? '') + (r.stderr ?? '') + (r.error ? `\n${r.error.message}` : ''),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let stats = { requests: 0, cached: 0 };
/** kind: 'execute' | 'compile' */
async function rust(kind, code, { crateType = 'bin', tests = false, crates = [] } = {}) {
  const key = crypto
    .createHash('sha1')
    .update(JSON.stringify({ kind, crateType, tests, EDITION, code }))
    .digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  if (USE_CACHE && fs.existsSync(cacheFile)) {
    stats.cached++;
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  stats.requests++;
  let result;
  if (LOCAL_RUSTC && !crates.length) {
    result = runLocal(kind, code, { crateType, tests });
  } else if (kind === 'compile') {
    result = await playground('compile', {
      channel: 'stable', mode: 'debug', edition: EDITION, crateType, tests: false, code, backtrace: false,
      target: 'mir', assemblyFlavor: 'att', demangleAssembly: 'demangle', processAssembly: 'filter',
    });
  } else {
    result = await playground('execute', {
      channel: 'stable', mode: 'debug', edition: EDITION, crateType, tests, code, backtrace: false,
    });
  }
  if (!result.infra) fs.writeFileSync(cacheFile, JSON.stringify(result));
  return result;
}

// ------------------------------------------------------------------ expectations
const NOISE = /^\s*(Compiling playground|Finished `|Running `|Running unittests|Doc-tests|warning: `playground`)/;
function cleanStderr(s) {
  return String(s || '')
    .split('\n')
    .filter((l) => !NOISE.test(l))
    .join('\n')
    .trim();
}
function excerpt(r, max = 30) {
  const parts = [];
  const err = cleanStderr(r.stderr);
  if (err) parts.push(err);
  if (r.stdout && r.stdout.trim()) parts.push('--- stdout ---\n' + r.stdout.trim());
  const lines = parts.join('\n').split('\n');
  return lines.slice(0, max).join('\n') + (lines.length > max ? `\n… (+${lines.length - max} satır)` : '');
}
function compileErrorCodes(stderr) {
  return [...new Set([...String(stderr).matchAll(/error\[(E\d{4})\]/g)].map((m) => m[1]))];
}
const isCompileError = (r) => /(^|\n)error(\[E\d{4}\])?:/.test(r.stderr) && !/Running `/.test(r.stderr) && !/running \d+ tests?/.test(r.stdout);
const hasWarnings = (r) => /(^|\n)warning: (?!`playground`)/.test(r.stderr);

const expect = {
  ok: (r) => (r.success ? null : `başarısız olmamalıydı`),
  compileFail: (code) => (r) => {
    if (r.success) return 'derlenmemesi gerekirken DERLENDİ';
    if (!isCompileError(r)) return 'derleme hatası beklenirken başka bir sorun oluştu';
    if (code && !compileErrorCodes(r.stderr).includes(code))
      return `beklenen hata ${code}, gelen: ${compileErrorCodes(r.stderr).join(', ') || 'kodsuz hata'}`;
    return null;
  },
  panic: (r) => {
    if (r.success) return 'panik bekleniyordu ama program başarıyla bitti';
    if (!/panicked/.test(r.stderr)) return isCompileError(r) ? 'derleme hatası (panik bekleniyordu)' : 'panik mesajı yok';
    return null;
  },
  output: (expected) => (r) => {
    if (!r.success) return 'program başarısız oldu';
    const got = normalizeOutput(r.stdout);
    if (got !== expected) return `çıktı uyuşmuyor\n    beklenen: ${JSON.stringify(expected)}\n    gelen   : ${JSON.stringify(got)}`;
    return null;
  },
  notPass: (r) => (r.success ? 'başlangıç kodu ZATEN geçiyor (alıştırma çözülmüş durumda)' : null),
};

// ------------------------------------------------------------------ job collection
/** A check = one compile/run with an expectation. */
const checks = [];
function add(file, line, label, kind, code, opts, expectFn, { warnable = false } = {}) {
  checks.push({ file, line, label, kind, code, opts, expectFn, warnable });
}

function codeChecks(file, line, label, b) {
  const crateType = b.isLib ? 'lib' : 'bin';
  const opts = { crateType, crates: b.crates || [] };
  switch (b.mode) {
    case 'ignore':
      return;
    case 'norun':
      return add(file, line, label, 'compile', b.code, opts, expect.ok, { warnable: true });
    case 'compile_fail':
      return add(file, line, label, 'compile', b.code, opts, expect.compileFail(b.errorCode));
    case 'should_panic':
      if (b.isLib) return add(file, line, label + ' (lib, sadece derleme)', 'compile', b.code, opts, expect.ok);
      return add(file, line, label, 'execute', b.code, opts, expect.panic);
    default:
      if (b.isLib) return add(file, line, label + ' (lib)', 'compile', b.code, opts, expect.ok, { warnable: true });
      return add(file, line, label, 'execute', b.code, opts, expect.ok, { warnable: true });
  }
}

function blockChecks(file, b) {
  const L = b.line;
  const crates = b.crates || [];
  switch (b.type) {
    case 'code':
      return codeChecks(file, L, `rust kod bloğu (${b.mode})`, b);
    case 'predict': {
      const expected = b.options ? b.options[b.answer] : b.output;
      return add(file, L, 'predict', 'execute', b.code, { crateType: 'bin', crates }, expect.output(expected));
    }
    case 'compiles': {
      const crateType = hasMain(b.code) ? 'bin' : 'lib';
      return add(file, L, `compiles (cevap: ${b.answer ? 'derlenir' : 'derlenmez'})`, 'compile', b.code, { crateType, crates },
        b.answer ? expect.ok : expect.compileFail(b.error));
    }
    case 'fill': {
      // First answers together, then every alternative answer swapped in on its own (others stay first):
      // an accepted alternative that doesn't compile or changes the output is a content bug.
      const firsts = b.blanks.map((x) => x[0]);
      const variants = [{ label: 'fill', answers: firsts }];
      b.blanks.forEach((alts, i) => alts.slice(1).forEach((alt) =>
        variants.push({ label: `fill (boşluk ${i} alternatifi ${JSON.stringify(alt)})`, answers: firsts.map((f, k) => (k === i ? alt : f)) })));
      for (const v of variants) {
        const code = fillCode(b.code, v.answers);
        if (!hasMain(code)) add(file, L, v.label + ' (lib)', 'compile', code, { crateType: 'lib', crates }, expect.ok);
        else add(file, L, v.label, 'execute', code, { crateType: 'bin', crates }, b.output !== undefined ? expect.output(b.output) : expect.ok);
      }
      return;
    }
    case 'parsons': {
      if (b.verify === false) return;
      const code = b.source;
      if (!hasMain(code)) return add(file, L, 'parsons (lib)', 'compile', code, { crateType: 'lib' }, expect.ok);
      return add(file, L, 'parsons', 'execute', code, { crateType: 'bin' }, expect.ok);
    }
    case 'exercise': {
      const name = `exercise "${b.title}"`;
      const solCrate = hasMain(b.solution) ? 'bin' : 'lib';
      const startCrate = hasMain(b.starter) ? 'bin' : 'lib';
      // forbid / require are checked locally against the solution
      for (const f of b.forbid)
        if (new RegExp(f.pattern).test(b.solution)) failures.push({ file, line: L, label: `${name}: çözüm 'forbid' kuralını ihlal ediyor (${f.pattern})`, detail: '' });
      for (const q of b.require)
        if (!new RegExp(q.pattern).test(b.solution)) failures.push({ file, line: L, label: `${name}: çözüm 'require' kuralını sağlamıyor (${q.pattern})`, detail: '' });
      const ruleViolated = (code) =>
        b.forbid.some((f) => new RegExp(f.pattern).test(code)) || b.require.some((q) => !new RegExp(q.pattern).test(code));

      if (b.check === 'tests') {
        add(file, L, `${name}: çözüm + testler`, 'execute', wrapTests(b.solution, b.tests), { crateType: solCrate, tests: true, crates }, expect.ok);
        if (b.starterCompiles) add(file, L, `${name}: başlangıç kodu derlenmeli`, 'compile', b.starter, { crateType: startCrate, crates }, expect.ok);
        if (!ruleViolated(b.starter))
          add(file, L, `${name}: başlangıç kodu testleri geçmemeli`, 'execute', wrapTests(b.starter, b.tests), { crateType: startCrate, tests: true, crates }, expect.notPass);
      } else if (b.check === 'output') {
        add(file, L, `${name}: çözüm çıktısı`, 'execute', b.solution, { crateType: 'bin', crates }, expect.output(b.expectedOutput));
        if (b.starterCompiles) add(file, L, `${name}: başlangıç kodu derlenmeli`, 'compile', b.starter, { crateType: startCrate, crates }, expect.ok);
        if (!ruleViolated(b.starter))
          add(file, L, `${name}: başlangıç kodu zaten doğru çıktıyı vermemeli`, 'execute', b.starter, { crateType: 'bin', crates },
            (r) => (expect.output(b.expectedOutput)(r) === null ? 'başlangıç kodu ZATEN doğru çıktıyı veriyor' : null));
      } else {
        add(file, L, `${name}: çözüm çalışmalı`, 'execute', b.solution, { crateType: solCrate, crates }, expect.ok);
        if (!b.starterCompiles) add(file, L, `${name}: başlangıç kodu derlenmemeli (starter_compiles: false)`, 'compile', b.starter, { crateType: startCrate, crates }, expect.compileFail(null));
        else if (!ruleViolated(b.starter))
          add(file, L, `${name}: başlangıç kodu zaten geçiyor olmamalı`, 'execute', b.starter, { crateType: startCrate, crates }, expect.notPass);
      }
      return;
    }
    default:
      return;
  }
}

const failures = [];
const md = createMarkdown(null);
let problems = [];

const singleFile = val('--file', null);
if (singleFile) {
  // Verify one markdown file in isolation (handy while writing a lesson).
  const abs = path.resolve(singleFile);
  const kind = /boss\.md$/.test(abs) ? 'boss' : /summary\.md$/.test(abs) ? 'summary' : 'lesson';
  const { lesson, errors, warnings } = parseLesson(fs.readFileSync(abs, 'utf8'), { file: singleFile, md, kind });
  for (const e of errors) problems.push({ file: singleFile, line: e.line, level: 'error', message: e.message });
  for (const w of warnings) problems.push({ file: singleFile, line: w.line, level: 'warning', message: w.message });
  printProblems(problems.filter((p) => p.level === 'warning'));
  if (lesson) {
    for (const step of lesson.steps) for (const b of step.blocks) blockChecks(singleFile, b);
    for (const s of lesson.staticRust || []) codeChecks(singleFile, s.line, `statik rust (${s.mode})`, s);
  }
} else if (!ONLY_REFERENCE) {
  const loaded = loadContent({ md, only: onlyModules.length ? onlyModules : null });
  problems = loaded.problems;
  for (const lesson of Object.values(loaded.lessons)) {
    for (const step of lesson.steps) for (const b of step.blocks) blockChecks(lesson.file, b);
    for (const s of lesson.staticRust || [])
      codeChecks(lesson.file, s.line, `callout içi rust (${s.mode})`, s);
  }
  for (const m of loaded.modules)
    for (const s of m.summaryStaticRust || []) codeChecks(m.summaryFile, s.line, `özet kartı rust (${s.mode})`, s);
}
if (!singleFile && (ONLY_REFERENCE || !onlyModules.length)) {
  const loaded = loadContent({ md, only: ['m00'] }); // reference only
  for (const p of loaded.problems) if (/reference/.test(p.file)) problems.push(p);
  const f = 'content/reference/errors.yaml';
  for (const e of loaded.reference.errors) {
    if (!e.code) continue;
    add(f, 1, `${e.code} hatalı örnek`, 'compile', e.bad, { crateType: hasMain(e.bad) ? 'bin' : 'lib' }, expect.compileFail(e.code));
    add(f, 1, `${e.code} düzeltilmiş örnek`, hasMain(e.fix) ? 'execute' : 'compile', e.fix, { crateType: hasMain(e.fix) ? 'bin' : 'lib' }, expect.ok);
  }
}

// ------------------------------------------------------------------ run
const structural = printProblems(problems.filter((p) => p.level === 'error'), { showWarnings: false });
console.log(
  `\nRust doğrulayıcı — ${checks.length} kontrol · arka uç: ${LOCAL_RUSTC ? 'yerel rustc (+ Playground crate için)' : 'Rust Playground'} · eşzamanlılık ${CONCURRENCY}`,
);

const warningsList = [];
let done = 0;
let infraFailures = 0;
const t0 = Date.now();
let cursor = 0;
async function worker() {
  while (cursor < checks.length) {
    const c = checks[cursor++];
    const r = await rust(c.kind, c.code, c.opts);
    if (r.infra) infraFailures++;
    const why = c.expectFn(r);
    if (why) failures.push({ file: c.file, line: c.line, label: `${c.label}: ${why}`, detail: excerpt(r), code: c.code });
    else if (c.warnable && hasWarnings(r)) warningsList.push({ file: c.file, line: c.line, label: c.label, detail: excerpt(r, 12) });
    done++;
    if (process.stdout.isTTY && done % 5 === 0) process.stdout.write(`\r  ${done}/${checks.length}…`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
if (process.stdout.isTTY) process.stdout.write('\r');

failures.sort((a, b) => (a.file + String(a.line).padStart(5, '0')).localeCompare(b.file + String(b.line).padStart(5, '0')));
for (const f of failures) {
  console.log(`\n✗ ${f.file}:${f.line}  ${f.label}`);
  if (f.detail) console.log(f.detail.split('\n').map((l) => '    ' + l).join('\n'));
}
if (SHOW_WARNINGS)
  for (const w of warningsList) {
    console.log(`\n⚠ ${w.file}:${w.line}  ${w.label}: derleyici uyarısı`);
    console.log(w.detail.split('\n').map((l) => '    ' + l).join('\n'));
  }

const report = {
  checks: checks.length, failures: failures.length, warnings: warningsList.length,
  structuralErrors: structural.errors, requests: stats.requests, cached: stats.cached,
  list: failures.map(({ code, ...rest }) => rest),
};
fs.writeFileSync(path.join(ROOT, '.cache', `verify-report${onlyModules.length ? '-' + onlyModules.join('-') : ''}.json`), JSON.stringify(report, null, 2));

console.log(
  `\n${checks.length - failures.length}/${checks.length} kontrol geçti · ${failures.length} başarısız · ` +
    `${warningsList.length} uyarılı örnek${SHOW_WARNINGS ? '' : ' (--show-warnings ile göster)'} · ` +
    `${structural.errors} yapısal hata · ${stats.requests} derleme, ${stats.cached} önbellekten · ${Math.round((Date.now() - t0) / 1000)} sn`,
);
if (infraFailures) console.log(`! ${infraFailures} kontrol altyapı (ağ) sorunu nedeniyle başarısız — tekrar çalıştırın.`);
process.exit(failures.length || structural.errors ? 1 : 0);
