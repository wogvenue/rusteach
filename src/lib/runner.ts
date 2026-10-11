// Renderer-side Rust runner. Electron: IPC to the main process (local rustc/cargo or Playground).
// Browser dev mode: Rust Playground through the Vite proxy (/playground -> play.rust-lang.org).
import type { RunRequest, RunResult } from '../types/bridge';

export const EDITION = '2024';

export function hasMain(code: string): boolean {
  return /(^|\n)\s*(pub\s+)?(async\s+)?fn\s+main\s*\(/.test(code);
}

/** Exactly mirrors wrapTests() in scripts/lib/lesson-parser.mjs - keep them in sync. */
export function wrapTests(code: string, tests: string): string {
  const indented = tests
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => (l.length ? '    ' + l : l))
    .join('\n');
  return `${code.replace(/\s+$/, '')}\n\n#[cfg(test)]\nmod rusteach_tests {\n    #[allow(unused_imports)]\n    use super::*;\n\n${indented}\n}\n`;
}

/** Mirrors normalizeOutput() in the parser. */
export function normalizeOutput(s: string): string {
  return (s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

const NOISE =
  /^\s*(Compiling playground|Compiling rusteach|Finished `|Running `|Running unittests|Doc-tests|warning: `(playground|rusteach)`|error: could not compile `(playground|rusteach)`|error: test failed, to rerun)/;

export function cleanCompilerOutput(s: string): string {
  return (s ?? '')
    .split('\n')
    .filter((l) => !NOISE.test(l))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
}

export function isCompileError(stderr: string, stdout = ''): boolean {
  return /(^|\n)error(\[E\d{4}\])?:/.test(stderr) && !/Running `/.test(stderr) && !/running \d+ tests?/.test(stdout);
}

/** Error codes (E0382...) mentioned in compiler output. */
export function errorCodes(stderr: string): string[] {
  return [...new Set([...stderr.matchAll(/error\[(E\d{4})\]/g)].map((m) => m[1]))];
}

/** Parses `cargo test` output into a per-test summary. */
export function parseTestOutput(stdout: string): { passed: string[]; failed: string[]; total: number } {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const m of stdout.matchAll(/^test (\S+) \.\.\. (ok|FAILED|ignored)/gm)) {
    const name = m[1].replace(/^rusteach_tests::/, '');
    if (m[2] === 'ok') passed.push(name);
    else if (m[2] === 'FAILED') failed.push(name);
  }
  return { passed, failed, total: passed.length + failed.length };
}

async function runViaPlayground(req: RunRequest): Promise<RunResult> {
  const t0 = performance.now();
  const crateType = req.crateType ?? (hasMain(req.code) ? 'bin' : 'lib');
  const base = { channel: 'stable', mode: 'debug', edition: EDITION, crateType, code: req.code, backtrace: false };
  const endpoint = req.mode === 'compile' ? 'compile' : 'execute';
  const body =
    req.mode === 'compile'
      ? { ...base, tests: false, target: 'mir', assemblyFlavor: 'att', demangleAssembly: 'demangle', processAssembly: 'filter' }
      : { ...base, tests: req.mode === 'test' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    const res = await fetch(`/playground/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const j = await res.json();
    const durationMs = Math.round(performance.now() - t0);
    if (typeof j.success !== 'boolean') {
      const msg = String(j.error ?? 'Bilinmeyen hata');
      const timedOut = /timed out|timeout/i.test(msg);
      return {
        ok: false, stdout: '', stderr: msg, compileError: false, timedOut, durationMs, backend: 'online',
        infraError: timedOut ? undefined : msg,
      };
    }
    const stderr: string = j.stderr ?? '';
    const stdout: string = j.stdout ?? '';
    return {
      ok: j.success,
      stdout,
      stderr: cleanCompilerOutput(stderr),
      compileError: !j.success && isCompileError(stderr, stdout),
      timedOut: /timed out|Killed/i.test(stderr),
      durationMs,
      backend: 'online',
    };
  } catch (e) {
    return {
      ok: false, stdout: '', stderr: '', compileError: false, timedOut: false,
      durationMs: Math.round(performance.now() - t0), backend: 'online',
      infraError: 'Rust Playground\'a ulaşılamadı. İnternet bağlantını kontrol et ya da Rust\'ı bilgisayarına kur.',
    };
  }
}

export async function runRust(req: RunRequest): Promise<RunResult> {
  const full: RunRequest = { ...req, crateType: req.crateType ?? (hasMain(req.code) ? 'bin' : 'lib') };
  if (window.rusteach) return window.rusteach.run(full);
  return runViaPlayground(full);
}

/** Learner-facing explanation of a run result, in Turkish. */
export function describeResult(r: RunResult): string {
  if (r.infraError) return r.infraError;
  if (r.timedOut) return 'Program zaman aşımına uğradı, sonsuz bir döngü olabilir mi?';
  if (r.compileError) return 'Derleme hatası, derleyicinin mesajını dikkatle oku, genellikle çözümü söyler.';
  if (!r.ok) return /panicked/.test(r.stderr) ? 'Program panik yaptı (panic).' : 'Program hata koduyla sonlandı.';
  return 'Başarılı!';
}
