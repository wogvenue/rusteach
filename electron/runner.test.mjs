// Tests for electron/runner.cjs — run with plain Node:  node electron/runner.test.mjs
//
// Offline tests cover the building blocks (process control, request validation, backend choice,
// output post-processing parity with src/lib/runner.ts). The end-to-end tests talk to the real
// Rust Playground (this is also what the app uses when Rust is not installed locally).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { wrapTests, hasMain as parserHasMain } from '../scripts/lib/lesson-parser.mjs';

const require = createRequire(import.meta.url);
const R = require('./runner.cjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rusteach-runner-test-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 }));

const noRust = async () => ({ rustc: null, cargo: null });
const makeRunner = (extra = {}) =>
  R.createRunner({ tempDir: path.join(work, 'tmp'), sandboxDir: path.join(work, 'sandbox'), ...extra });

/** Fake fetch that records requests and answers like the Playground. */
function fakeFetch(answer) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const { status = 200, json } = typeof answer === 'function' ? answer(calls.length) : answer;
    return { status, text: async () => JSON.stringify(json) };
  };
  fn.calls = calls;
  return fn;
}

// ------------------------------------------------------------------ offline

test('output post-processing is identical to src/lib/runner.ts', () => {
  const ts = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'runner.ts'), 'utf8');
  const m = ts.match(/const NOISE =\s*\/(.+)\/;\s*$/m);
  assert.ok(m, 'NOISE pattern not found in src/lib/runner.ts');
  assert.equal(R.NOISE.source, m[1], 'NOISE differs from src/lib/runner.ts — keep them in sync');
  const compileErrorExpr =
    '/(^|\\n)error(\\[E\\d{4}\\])?:/.test(stderr) && !/Running `/.test(stderr) && !/running \\d+ tests?/.test(stdout)';
  assert.ok(ts.includes(compileErrorExpr), 'isCompileError differs from src/lib/runner.ts — keep them in sync');
  assert.ok(fs.readFileSync(path.join(HERE, 'runner.cjs'), 'utf8').includes(compileErrorExpr));

  const playgroundStderr =
    '   Compiling playground v0.0.1 (/playground)\nerror[E0382]: borrow of moved value: `s`\n --> src/main.rs:4:20\n\n' +
    "warning: `playground` (bin \"playground\") generated 1 warning\nerror: could not compile `playground` (bin \"playground\") due to 1 previous error\n";
  assert.equal(R.cleanCompilerOutput(playgroundStderr), 'error[E0382]: borrow of moved value: `s`\n --> src/main.rs:4:20');
  assert.equal(R.isCompileError(playgroundStderr), true);
  const panicStderr = '    Finished `dev` profile\n     Running `target/debug/playground`\nthread \'main\' panicked at src/main.rs:2:5:\nboom\n';
  assert.equal(R.isCompileError(panicStderr), false);
  assert.equal(R.cleanCompilerOutput(panicStderr), "thread 'main' panicked at src/main.rs:2:5:\nboom");
  assert.equal(R.isCompileError('error: test failed', 'running 2 tests\n'), false);
});

test('hasMain agrees with the content parser', () => {
  for (const code of ['fn main() {}', 'pub fn main() {}', '#[tokio::main]\nasync fn main() {}', 'fn mainly() {}', 'struct A;', '  fn main ( ) {}']) {
    assert.equal(R.hasMain(code), parserHasMain(code), code);
  }
});

test('crate detection and request validation', () => {
  assert.deepEqual(R.detectCrates('use rand::Rng;\nfn main() { let v: serde_json::Value = todo!(); }').sort(), ['rand', 'serde_json']);
  assert.deepEqual(R.detectCrates('#[tokio::main]\nasync fn main() {}'), ['tokio']);
  assert.deepEqual(R.detectCrates('use std::collections::HashMap;\nfn main() {}'), []);
  assert.deepEqual(R.detectCrates('extern crate itertools;'), ['itertools']);

  const { req } = R.normalizeRequest({ code: 'fn main() {}', mode: 'weird', crates: ['serde-json', 42, 'tokio'] });
  assert.equal(req.mode, 'run');
  assert.equal(req.crateType, 'bin');
  assert.equal(req.backend, 'auto');
  assert.deepEqual(req.crates.sort(), ['serde_json', 'tokio']);
  assert.equal(R.normalizeRequest({ code: 'pub fn f() {}' }).req.crateType, 'lib');
  assert.ok(R.normalizeRequest(null).error);
  assert.ok(R.normalizeRequest({ code: 'x'.repeat(R.LIMITS.code + 1) }).error);
});

test('Windows paths in compiler output are shown like the Playground', () => {
  assert.equal(R.normalizePaths(' --> src\\main.rs:3:5\r\n'), ' --> src/main.rs:3:5\n');
  assert.equal(R.normalizePaths("thread 'main' panicked at src\\bin\\x.rs:1:1:"), "thread 'main' panicked at src/bin/x.rs:1:1:");
});

test('cargo JSON stream: picks the right executable', () => {
  const lines = [
    '{"reason":"compiler-artifact","target":{"name":"serde"},"profile":{"test":false},"executable":null}',
    '{"reason":"compiler-artifact","target":{"name":"rusteach"},"profile":{"test":false},"executable":"C:\\\\s\\\\target\\\\debug\\\\rusteach.exe"}',
    '{"reason":"compiler-artifact","target":{"name":"rusteach"},"profile":{"test":true},"executable":"C:\\\\s\\\\target\\\\debug\\\\deps\\\\rusteach-1a2b.exe"}',
    '{"reason":"build-finished","success":true}',
  ].join('\n');
  assert.equal(R.findExecutable(lines, false), 'C:\\s\\target\\debug\\rusteach.exe');
  assert.equal(R.findExecutable(lines, true), 'C:\\s\\target\\debug\\deps\\rusteach-1a2b.exe');
  assert.equal(R.findExecutable('not json', false), null);
});

test('infrastructure problems are recognised', () => {
  assert.ok(R.isLinkerMissing('error: linker `link.exe` not found\n  |\n  = note: program not found'));
  assert.ok(R.isNetworkFailure('error: failed to get `rand` as a dependency of package `rusteach v0.1.0`'));
  assert.ok(!R.isNetworkFailure('error[E0425]: cannot find value `x` in this scope'));
  assert.match(R.SANDBOX_MANIFEST, /edition = "2024"/);
  for (const dep of ['rand', 'serde', 'serde_json', 'tokio', 'regex', 'itertools', 'anyhow', 'thiserror', 'rayon', 'chrono', 'futures']) {
    assert.match(R.SANDBOX_MANIFEST, new RegExp(`^${dep} = `, 'm'), dep);
  }
});

test('runProcess: passes stdin and captures UTF-8 output', async () => {
  const r = await R.runProcess(process.execPath, ['-e', "process.stdin.on('data', d => process.stdout.write('girdi: ' + d))"], {
    stdin: 'çalışkan öğrenci',
    timeoutMs: 10_000,
  });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'girdi: çalışkan öğrenci');
  assert.equal(r.timedOut, false);
});

test('runProcess: timeout kills the whole process tree', async () => {
  // The grandchild inherits the pipes: without a tree kill 'close' would never arrive.
  const script =
    "require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });" +
    "setInterval(() => {}, 1000); console.log('basladi');";
  const t0 = Date.now();
  const r = await R.runProcess(process.execPath, ['-e', script], { timeoutMs: 1500 });
  assert.equal(r.timedOut, true);
  assert.notEqual(r.code, 0);
  assert.match(r.stdout, /basladi/);
  assert.ok(Date.now() - t0 < 8000, `took ${Date.now() - t0} ms`);
});

test('runProcess: output is capped and the process stopped', async () => {
  const r = await R.runProcess(process.execPath, ['-e', "for(;;) process.stdout.write('x'.repeat(65536))"], {
    timeoutMs: 15_000,
    maxOutput: 256 * 1024,
  });
  assert.equal(r.truncated, true);
  assert.equal(r.timedOut, false);
  assert.ok(r.stdout.length <= 256 * 1024);
});

test('runProcess: a missing program is reported, not thrown', async () => {
  const r = await R.runProcess(path.join(work, 'yok-boyle-bir-program.exe'), [], { timeoutMs: 5000 });
  assert.ok(r.error);
});

test('toolchain detection returns version strings or null', async () => {
  const tc = await R.detectToolchain();
  for (const k of ['rustc', 'cargo']) assert.ok(tc[k] === null || /^(rustc|cargo) \d/.test(tc[k]), `${k}: ${tc[k]}`);
});

test('backend choice: "local" without Rust gives a Turkish infraError', async () => {
  const runner = makeRunner({ detect: noRust, fetch: fakeFetch({ json: {} }) });
  const r = await runner.run({ code: 'fn main() {}', mode: 'run', backend: 'local' });
  assert.equal(r.ok, false);
  assert.equal(r.backend, 'local');
  assert.match(r.infraError, /Rust bu bilgisayarda kurulu değil/);
  const withCrates = await makeRunner({ detect: async () => ({ rustc: 'rustc 1.90.0', cargo: null, rustcCmd: 'rustc' }) }).run({
    code: 'use rand::Rng;\nfn main() {}',
    mode: 'run',
    backend: 'local',
  });
  assert.match(withCrates.infraError, /cargo bulunamadı/);
});

test('backend choice: "auto" without Rust uses the Playground with the app\'s request bodies', async () => {
  const fetch = fakeFetch({ json: { success: true, stdout: 'merhaba\n', stderr: '   Compiling playground v0.0.1\n    Finished `dev` profile\n     Running `target/debug/playground`\n' } });
  const runner = makeRunner({ detect: noRust, fetch });
  const r = await runner.run({ code: 'fn main() { println!("merhaba"); }', mode: 'run' });
  assert.deepEqual(
    { ok: r.ok, stdout: r.stdout, stderr: r.stderr, backend: r.backend, compileError: r.compileError, timedOut: r.timedOut },
    { ok: true, stdout: 'merhaba\n', stderr: '', backend: 'online', compileError: false, timedOut: false },
  );
  assert.equal(fetch.calls[0].url, 'https://play.rust-lang.org/execute');
  assert.deepEqual(fetch.calls[0].body, {
    channel: 'stable', mode: 'debug', edition: '2024', crateType: 'bin', code: 'fn main() { println!("merhaba"); }', backtrace: false, tests: false,
  });

  await runner.run({ code: 'pub fn f() {}', mode: 'compile' });
  assert.equal(fetch.calls[1].url, 'https://play.rust-lang.org/compile');
  assert.equal(fetch.calls[1].body.target, 'mir');
  assert.equal(fetch.calls[1].body.crateType, 'lib');
  await runner.run({ code: 'pub fn f() {}', mode: 'test' });
  assert.equal(fetch.calls[2].body.tests, true);
});

test('auto: a broken local toolchain falls back to the Playground and cleans up', async () => {
  const missing = path.join(work, 'yok');
  const fetch = fakeFetch({ json: { success: true, stdout: 'çevrim içi\n', stderr: '' } });
  const runner = makeRunner({
    fetch,
    detect: async () => ({
      rustc: 'rustc 1.90.0 (1159e78c4 2025-09-14)',
      cargo: 'cargo 1.90.0 (840b83a10 2025-07-30)',
      rustcCmd: path.join(missing, 'rustc.exe'),
      cargoCmd: path.join(missing, 'cargo.exe'),
    }),
  });
  const auto = await runner.run({ code: 'fn main() {}', mode: 'run' });
  assert.equal(auto.backend, 'online');
  assert.equal(auto.stdout, 'çevrim içi\n');

  const local = await runner.run({ code: 'fn main() {}', mode: 'run', backend: 'local' });
  assert.equal(local.backend, 'local');
  assert.match(local.infraError, /rustc çalıştırılamadı/);
  assert.equal('linker' in local, false);

  await new Promise((r) => setTimeout(r, 500));
  const left = fs.readdirSync(path.join(work, 'tmp')).filter((n) => n.startsWith('rusteach-run-'));
  assert.deepEqual(left, [], 'temporary run directories are removed');
});

test('an old Rust (< 1.85, no edition 2024) is an infrastructure problem', async () => {
  assert.equal(R.tooOldFor2024('rustc 1.84.1 (e71f9a9a9 2025-01-27)'), '1.84.1');
  assert.equal(R.tooOldFor2024('rustc 1.85.0 (4d91de4e4 2025-02-17)'), null);
  assert.equal(R.tooOldFor2024('cargo 2.0.0'), null);
  const old = async () => ({ rustc: 'rustc 1.80.0 (051478957 2024-07-21)', cargo: 'cargo 1.80.0', rustcCmd: 'rustc', cargoCmd: 'cargo' });
  const local = await makeRunner({ detect: old }).run({ code: 'fn main() {}', mode: 'run', backend: 'local' });
  assert.match(local.infraError, /rustup update/);
  const fetch = fakeFetch({ json: { success: true, stdout: '', stderr: '' } });
  const auto = await makeRunner({ detect: old, fetch }).run({ code: 'fn main() {}', mode: 'run' });
  assert.equal(auto.backend, 'online');
});

test('Playground: busy servers are retried, timeouts are not', async () => {
  const flaky = fakeFetch((n) => (n === 1 ? { status: 503, json: { error: 'overloaded' } } : { json: { success: true, stdout: 'ok', stderr: '' } }));
  const r1 = await makeRunner({ detect: noRust, fetch: flaky }).run({ code: 'fn main() {}', mode: 'run', backend: 'online' });
  assert.equal(r1.ok, true);
  assert.equal(flaky.calls.length, 2);

  const timeout = fakeFetch({ status: 500, json: { error: 'The operation timed out: deadline has elapsed' } });
  const r2 = await makeRunner({ detect: noRust, fetch: timeout }).run({ code: 'fn main() { loop {} }', mode: 'run', backend: 'online' });
  assert.equal(timeout.calls.length, 1);
  assert.equal(r2.timedOut, true);
  assert.equal(r2.infraError, undefined);

  const offline = async () => {
    throw new TypeError('fetch failed');
  };
  const r3 = await makeRunner({ detect: noRust, fetch: offline }).run({ code: 'fn main() {}', mode: 'run', backend: 'online' });
  assert.match(r3.infraError, /Rust Playground'a ulaşılamadı/);
});

// ------------------------------------------------------------------ end-to-end (Rust Playground)

const online = makeRunner({ detect: noRust });

/** The Playground is a shared public service: retry transient infrastructure failures. */
async function play(req) {
  let r;
  for (let i = 0; i < 4; i++) {
    r = await online.run({ backend: 'auto', ...req });
    if (!r.infraError) return r;
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  assert.fail(`Playground unavailable: ${r.infraError}`);
}

test('e2e: hello world', { timeout: 120_000 }, async () => {
  const r = await play({ code: 'fn main() {\n    println!("Merhaba, Rust! ğüşıöç");\n}\n', mode: 'run' });
  assert.equal(r.ok, true);
  assert.equal(r.backend, 'online');
  assert.equal(r.stdout, 'Merhaba, Rust! ğüşıöç\n');
  assert.equal(r.stderr, '');
  assert.equal(r.compileError, false);
});

test('e2e: compile error E0382 is detected', { timeout: 120_000 }, async () => {
  const code = 'fn main() {\n    let s1 = String::from("merhaba");\n    let s2 = s1;\n    println!("{s1} {s2}");\n}\n';
  const r = await play({ code, mode: 'run' });
  assert.equal(r.ok, false);
  assert.equal(r.compileError, true);
  assert.match(r.stderr, /error\[E0382\]: borrow of moved value: `s1`/);
  assert.match(r.stderr, /--> src\/main\.rs:4:/);
  assert.doesNotMatch(r.stderr, /Compiling playground|could not compile/);
});

test('e2e: a panic is a runtime failure, not a compile error', { timeout: 120_000 }, async () => {
  const r = await play({ code: 'fn main() {\n    let v: Vec<i32> = Vec::new();\n    println!("{}", v[3]);\n}\n', mode: 'run' });
  assert.equal(r.ok, false);
  assert.equal(r.compileError, false);
  assert.equal(r.timedOut, false);
  assert.match(r.stderr, /panicked at src\/main\.rs:3:/);
  assert.match(r.stderr, /index out of bounds/);
  assert.doesNotMatch(r.stderr, /Running `/);
});

const exerciseTests = `#[test]
fn uzunlugu_dogru() {
    let (s, n) = uzunluk_hesapla(String::from("merhaba"));
    assert_eq!(n, 7, "\\"merhaba\\" 7 harflidir");
    assert_eq!(s, "merhaba");
}

#[test]
fn bos_metin() {
    assert_eq!(uzunluk_hesapla(String::new()).1, 0);
}`;

test('e2e: wrapTests — all tests pass', { timeout: 120_000 }, async () => {
  const solution = 'fn uzunluk_hesapla(s: String) -> (String, usize) {\n    let n = s.len();\n    (s, n)\n}\n\nfn main() {\n    let (s, n) = uzunluk_hesapla(String::from("rust"));\n    println!("{s}: {n}");\n}\n';
  const r = await play({ code: wrapTests(solution, exerciseTests), mode: 'test' });
  assert.equal(r.ok, true, r.stderr);
  assert.equal(r.compileError, false);
  assert.match(r.stdout, /test rusteach_tests::uzunlugu_dogru \.\.\. ok/);
  assert.match(r.stdout, /test rusteach_tests::bos_metin \.\.\. ok/);
  assert.match(r.stdout, /test result: ok\. 2 passed/);
});

test('e2e: wrapTests — a failing test', { timeout: 120_000 }, async () => {
  const wrong = 'fn uzunluk_hesapla(s: String) -> (String, usize) {\n    (s, 3)\n}\n';
  const r = await play({ code: wrapTests(wrong, exerciseTests), mode: 'test' });
  assert.equal(r.ok, false);
  assert.equal(r.compileError, false);
  assert.match(r.stdout, /test rusteach_tests::uzunlugu_dogru \.\.\. FAILED/);
  assert.match(r.stdout, /"merhaba" 7 harflidir/);
});

test('e2e: compile-only mode (type & borrow check, nothing runs)', { timeout: 120_000 }, async () => {
  const ok = await play({ code: 'pub fn ikiye_katla(x: i32) -> i32 {\n    x * 2\n}\n', mode: 'compile' });
  assert.equal(ok.ok, true, ok.stderr);
  assert.equal(ok.compileError, false);
  assert.equal(ok.stdout, '');

  const bad = await play({
    code: 'pub fn f() {\n    let mut v = vec![1, 2, 3];\n    let ilk = &v[0];\n    v.push(4);\n    println!("{ilk}");\n}\n',
    mode: 'compile',
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.compileError, true);
  assert.match(bad.stderr, /E0502/);
});

test('e2e: a tokio program (external crate)', { timeout: 120_000 }, async () => {
  const code = `use std::time::Duration;

#[tokio::main]
async fn main() {
    let a = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(20)).await;
        "görev bitti"
    });
    println!("{}", a.await.unwrap());
}
`;
  const r = await play({ code, mode: 'run', crates: ['tokio'] });
  assert.equal(r.ok, true, r.stderr);
  assert.equal(r.stdout, 'görev bitti\n');
});

test('e2e: an infinite loop times out', { timeout: 150_000 }, async () => {
  const r = await play({ code: 'fn main() {\n    let mut i: u64 = 0;\n    loop {\n        i = i.wrapping_add(1);\n    }\n}\n', mode: 'run' });
  assert.equal(r.ok, false);
  assert.equal(r.timedOut, true);
  assert.equal(r.compileError, false);
  assert.equal(r.infraError, undefined);
});
