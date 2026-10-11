// Rust runner for the Electron main process: RunRequest -> RunResult (see src/types/bridge.ts).
//
// Pure Node - no electron import - so it can be required from plain Node tests
// (node electron/runner.test.mjs). main.cjs injects the directories and Electron's net.fetch.
//
// Backends
//   local   std-only code  -> rustc in a unique temp dir (fast, no network)
//           code w/ crates -> a persistent cargo project ("sandbox") with the crates the lessons use
//   online  the official Rust Playground (play.rust-lang.org), same request bodies as src/lib/runner.ts
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const EDITION = '2024';
const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';
const PLAYGROUND_URL = 'https://play.rust-lang.org';

const LIMITS = {
  runMs: 10_000, // learner program (or test binary) wall time
  compileMs: 90_000, // local rustc, std-only
  cargoMs: 240_000, // cargo build/check/test; the first build downloads and compiles the crates
  warmupMs: 15 * 60_000, // background warm-up of the cargo sandbox
  playgroundMs: 60_000,
  output: 1024 * 1024, // captured bytes per stream
  cargoJson: 16 * 1024 * 1024, // cargo's JSON message stream (one line per compiled crate)
  code: 512 * 1024,
  stdin: 256 * 1024,
};

/** Crates of the local cargo sandbox - the set CONTENT_SPEC.md allows in lessons. */
const SANDBOX_DEPS = {
  rand: '"0.9"',
  serde: '{ version = "1", features = ["derive"] }',
  serde_json: '"1"',
  tokio: '{ version = "1", features = ["full"] }',
  regex: '"1"',
  itertools: '"0.14"',
  anyhow: '"1"',
  thiserror: '"2"',
  rayon: '"1"',
  chrono: '"0.4"',
  futures: '"0.3"',
};

const SANDBOX_MANIFEST = `# Rusteach yerel çalıştırma alanı, derslerde kullanılan crate'ler.
# Bu dosya Rusteach tarafından yönetilir; değişiklikler bir sonraki çalıştırmada geri alınır.
[package]
name = "rusteach"
version = "0.1.0"
edition = "${EDITION}"
publish = false

[dependencies]
${Object.entries(SANDBOX_DEPS)
  .map(([name, spec]) => `${name} = ${spec}`)
  .join('\n')}

[profile.dev]
debug = 0
`;

const MSG = {
  invalid: 'Geçersiz çalıştırma isteği.',
  tooLarge: 'Kod çok uzun (en fazla 512 KB çalıştırılabilir).',
  rustMissing:
    "Rust bu bilgisayarda kurulu değil. https://rustup.rs adresinden kurabilirsin (Rusteach'i yeniden başlatman gerekmez) " +
    "ya da Ayarlar'dan çevrim içi çalıştırıcıyı seçebilirsin.",
  cargoMissing:
    "Bu kod harici crate'ler kullanıyor ama cargo bulunamadı. Rust'ı rustup ile kurarsan cargo da gelir; " +
    "o zamana kadar Ayarlar'dan çevrim içi çalıştırıcıyı seçebilirsin.",
  linkerMissing:
    "Rust kurulu ama Windows'ta program oluşturmak için gereken Microsoft C++ Build Tools eksik. " +
    "Visual Studio Installer'dan “C++ ile masaüstü geliştirme” bileşenini kur ya da Ayarlar'dan çevrim içi çalıştırıcıyı seç.",
  crateDownload:
    "Crate'ler indirilemedi. tokio, serde gibi crate'ler ilk kullanımda bir kez internetten indirilir; " +
    'bağlantını kontrol edip tekrar dene.',
  playgroundUnreachable:
    "Rust Playground'a ulaşılamadı. İnternet bağlantını kontrol et ya da Rust'ı bilgisayarına kur.",
  playgroundSlow: 'Rust Playground 60 saniye içinde yanıt vermedi. Biraz sonra tekrar dene.',
  playgroundTimeout: 'Program süre sınırını aştı ve durduruldu.',
  playgroundFlood:
    'Program çok fazla çıktı üretti ve durduruldu (Rust Playground sınırı yaklaşık 640 KB). Sonsuz bir döngü olabilir mi?',
  outputCapped: '[Rusteach] Program 1 MB’tan fazla çıktı üretti ve durduruldu. Sonsuz bir döngü olabilir mi?',
  buildTimedOut:
    "Derleme 4 dakika içinde bitmedi. İlk derlemede crate'ler indirilip derlenir; biraz bekleyip tekrar dene.",
  tooOld: (v) =>
    `Bilgisayarındaki Rust sürümü (${v}) Rust 2024 için çok eski; en az 1.85 gerekir. ` +
    "Terminalde `rustup update` komutunu çalıştır ya da Ayarlar'dan çevrim içi çalıştırıcıyı seç.",
};

/** Edition 2024 needs rustc/cargo >= 1.85. Returns the version text when the tool is older. */
function tooOldFor2024(versionLine) {
  const m = /^(?:rustc|cargo) (\d+)\.(\d+)\.(\d+)/.exec(versionLine ?? '');
  if (!m) return null;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > 1 || (major === 1 && minor >= 85) ? null : `${m[1]}.${m[2]}.${m[3]}`;
}

// ------------------------------------------------------------------ output post-processing
// Keep identical to src/lib/runner.ts (runner.test.mjs checks that the NOISE pattern matches).

function hasMain(code) {
  return /(^|\n)\s*(pub\s+)?(async\s+)?fn\s+main\s*\(/.test(code);
}

const NOISE =
  /^\s*(Compiling playground|Compiling rusteach|Finished `|Running `|Running unittests|Doc-tests|warning: `(playground|rusteach)`|error: could not compile `(playground|rusteach)`|error: test failed, to rerun)/;

function cleanCompilerOutput(s) {
  return (s ?? '')
    .split('\n')
    .filter((l) => !NOISE.test(l))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
}

function isCompileError(stderr, stdout = '') {
  return /(^|\n)error(\[E\d{4}\])?:/.test(stderr) && !/Running `/.test(stderr) && !/running \d+ tests?/.test(stdout);
}

/** Windows cargo prints `src\main.rs`; the Playground and lessons show `src/main.rs`. */
function normalizePaths(s) {
  return (s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\bsrc\\((?:[\w-]+\\)*[\w-]+\.rs)\b/g, (_m, rest) => 'src/' + rest.replace(/\\/g, '/'));
}

function joinOutput(...parts) {
  return parts
    .map((p) => (p ?? '').replace(/\s+$/, ''))
    .filter(Boolean)
    .join('\n');
}

const CRATE_RE = new RegExp(String.raw`\b(${Object.keys(SANDBOX_DEPS).join('|')})\s*::`, 'g');
const EXTERN_CRATE_RE = /\bextern\s+crate\s+([A-Za-z_][\w]*)/g;

/** External crates referenced by the code itself (`tokio::`, `use serde::…`, `extern crate rand`). */
function detectCrates(code) {
  const found = new Set();
  for (const m of (code ?? '').matchAll(CRATE_RE)) found.add(m[1]);
  for (const m of (code ?? '').matchAll(EXTERN_CRATE_RE)) if (m[1] !== 'std' && m[1] !== 'core' && m[1] !== 'alloc') found.add(m[1]);
  return [...found];
}

const normalizeCrateName = (c) => c.trim().replace(/-/g, '_');

/** Validates an untrusted RunRequest coming over IPC and fills in defaults. */
function normalizeRequest(raw) {
  if (!raw || typeof raw !== 'object') return { error: MSG.invalid };
  if (typeof raw.code !== 'string') return { error: MSG.invalid };
  if (raw.code.length > LIMITS.code) return { error: MSG.tooLarge };
  const code = raw.code;
  const mode = raw.mode === 'test' || raw.mode === 'compile' ? raw.mode : 'run';
  const crateType = raw.crateType === 'bin' || raw.crateType === 'lib' ? raw.crateType : hasMain(code) ? 'bin' : 'lib';
  const declared = Array.isArray(raw.crates)
    ? raw.crates.filter((c) => typeof c === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(c)).map(normalizeCrateName)
    : [];
  const crates = [...new Set([...declared, ...detectCrates(code)])];
  const stdin = typeof raw.stdin === 'string' ? raw.stdin.slice(0, LIMITS.stdin) : '';
  const backend = raw.backend === 'local' || raw.backend === 'online' ? raw.backend : 'auto';
  return { req: { code, mode, crateType, crates, stdin, backend } };
}

const isLinkerMissing = (s) =>
  /linker `[^`]*link\.exe` not found|msvc targets depend on the msvc linker|error: linker `[^`]+` not found/.test(s);

const isNetworkFailure = (s) =>
  /failed to download|failed to get `[^`]+` as a dependency|unable to update registry|failed to query replaced source|spurious network error|Couldn't resolve host|failed to fetch|network failure|download of config\.json failed|failed to load source for dependency/i.test(
    s,
  );

/** Picks the freshly built executable out of cargo's `--message-format=json` stream. */
function findExecutable(jsonStdout, wantTest) {
  let exe = null;
  for (const line of (jsonStdout ?? '').split('\n')) {
    if (!line.startsWith('{')) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.reason !== 'compiler-artifact' || !msg.executable) continue;
    if (msg.target?.name !== 'rusteach') continue;
    if (!!msg.profile?.test !== wantTest) continue;
    exe = msg.executable;
  }
  return exe;
}

// ------------------------------------------------------------------ processes

const pathKey = (env) => Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';

/** Copy of env with `dir` prepended to PATH (rustup installs into ~/.cargo/bin). */
function withPath(env, dir) {
  const out = { ...env };
  if (!dir) return out;
  const key = pathKey(out);
  out[key] = out[key] ? `${dir}${path.delimiter}${out[key]}` : dir;
  return out;
}

function taskkillPath() {
  const root = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const exe = path.join(root, 'System32', 'taskkill.exe');
  return fs.existsSync(exe) ? exe : 'taskkill';
}

/** Kills a child and everything it spawned (cargo -> rustc, a program's own children…). */
function killTree(child) {
  if (!child || child.pid == null || child.exitCode !== null || child.signalCode !== null) return;
  if (IS_WIN) {
    try {
      const k = spawn(taskkillPath(), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      k.on('error', () => child.kill());
    } catch {
      child.kill();
    }
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL'); // detached => own process group
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Spawns a process (never through a shell) with a wall-clock timeout, optional stdin and an output cap.
 * Always resolves: { code, signal, stdout, stderr, timedOut, truncated, error, durationMs }.
 */
function runProcess(cmd, args, opts = {}) {
  const { cwd, env = process.env, stdin = '', timeoutMs = 0, maxOutput = LIMITS.output, onSpawn } = opts;
  const t0 = Date.now();
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], detached: !IS_WIN });
    } catch (error) {
      resolve({ code: null, signal: null, stdout: '', stderr: '', timedOut: false, truncated: false, error, durationMs: 0 });
      return;
    }
    onSpawn?.(child);

    const out = { chunks: [], size: 0 };
    const err = { chunks: [], size: 0 };
    let timedOut = false;
    let truncated = false;
    let spawnError = null;
    let exitInfo = null;
    let done = false;
    let graceTimer = null;

    const collect = (sink) => (buf) => {
      const room = maxOutput - sink.size;
      if (room > 0) sink.chunks.push(buf.length <= room ? buf : buf.subarray(0, room));
      sink.size += buf.length;
      if (sink.size > maxOutput && !truncated) {
        truncated = true;
        killTree(child);
      }
    };
    child.stdout.on('data', collect(out));
    child.stderr.on('data', collect(err));
    child.stdin.on('error', () => {}); // EPIPE: the program exited without reading its input
    child.stdin.end(stdin || undefined);

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killTree(child);
          }, timeoutMs)
        : null;

    const finish = (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      resolve({
        code: code ?? null,
        signal: signal ?? null,
        stdout: Buffer.concat(out.chunks).toString('utf8'),
        stderr: Buffer.concat(err.chunks).toString('utf8'),
        timedOut,
        truncated,
        error: spawnError,
        durationMs: Date.now() - t0,
      });
    };

    child.on('error', (e) => {
      spawnError = e;
      if (child.pid == null) finish(null, null); // could not start at all (ENOENT…)
    });
    child.on('exit', (code, signal) => {
      exitInfo = { code, signal };
      // Grandchildren may keep the pipes open after a kill; don't wait for them forever.
      graceTimer = setTimeout(() => finish(code, signal), 2000);
    });
    child.on('close', (code, signal) => finish(exitInfo ? exitInfo.code : code, exitInfo ? exitInfo.signal : signal));
  });
}

// ------------------------------------------------------------------ toolchain

function cargoBinDirs(env) {
  const dirs = [];
  if (env.CARGO_HOME) dirs.push(path.join(env.CARGO_HOME, 'bin'));
  const home = env.USERPROFILE || env.HOME || os.homedir();
  if (home) dirs.push(path.join(home, '.cargo', 'bin'));
  return [...new Set(dirs)];
}

async function probeVersion(cmd, env, tool) {
  const r = await runProcess(cmd, ['--version'], { env, timeoutMs: 20_000, maxOutput: 64 * 1024 });
  if (r.error || r.code !== 0) return null;
  const line = r.stdout.trim().split(/\r?\n/)[0] ?? '';
  return line.startsWith(`${tool} `) ? line : null;
}

/**
 * Finds rustc/cargo: first on PATH, then in ~/.cargo/bin (a freshly installed rustup is not on the PATH
 * of an app that was already running).
 */
async function detectToolchain(env = process.env) {
  const [pathRustc, pathCargo] = await Promise.all([probeVersion('rustc', env, 'rustc'), probeVersion('cargo', env, 'cargo')]);
  const tc = {
    rustc: pathRustc,
    cargo: pathCargo,
    rustcCmd: pathRustc ? 'rustc' : null,
    cargoCmd: pathCargo ? 'cargo' : null,
    binDir: null,
  };
  for (const dir of cargoBinDirs(env)) {
    if (tc.rustc && tc.cargo) break;
    const dirEnv = withPath(env, dir);
    const rustcExe = path.join(dir, 'rustc' + EXE);
    const cargoExe = path.join(dir, 'cargo' + EXE);
    const [r, c] = await Promise.all([
      !tc.rustc && fs.existsSync(rustcExe) ? probeVersion(rustcExe, dirEnv, 'rustc') : null,
      !tc.cargo && fs.existsSync(cargoExe) ? probeVersion(cargoExe, dirEnv, 'cargo') : null,
    ]);
    if (r) Object.assign(tc, { rustc: r, rustcCmd: rustcExe, binDir: dir });
    if (c) Object.assign(tc, { cargo: c, cargoCmd: cargoExe, binDir: tc.binDir ?? dir });
  }
  return tc;
}

// ------------------------------------------------------------------ runner

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createRunner(options = {}) {
  const {
    tempDir = path.join(os.tmpdir(), 'rusteach'),
    sandboxDir = path.join(os.tmpdir(), 'rusteach-sandbox'),
    fetch: fetchImpl = globalThis.fetch,
    env: baseEnv = process.env,
    playgroundUrl = PLAYGROUND_URL,
    detect = detectToolchain,
    limits: limitOverrides = {},
    log = () => {},
  } = options;
  const limits = { ...LIMITS, ...limitOverrides };

  const active = new Set();
  const track = (child) => {
    active.add(child);
    child.once('close', () => active.delete(child));
    child.once('error', () => active.delete(child));
  };
  const exec = (cmd, args, opts) => runProcess(cmd, args, { ...opts, onSpawn: track });

  // ---- toolchain cache
  let cached = null;
  let cachedAt = 0;
  let detecting = null;
  async function toolchain({ refresh = false } = {}) {
    const age = Date.now() - cachedAt;
    const stale = !cached || age > 5 * 60_000 || (!cached.rustc && age > 10_000);
    if (!refresh && !stale) return cached;
    if (!detecting) {
      detecting = Promise.resolve()
        .then(() => detect(baseEnv))
        .then((tc) => {
          cached = { rustc: null, cargo: null, rustcCmd: null, cargoCmd: null, binDir: null, ...tc };
          cachedAt = Date.now();
          return cached;
        })
        .catch((e) => {
          log('toolchain detection failed', e);
          cached = { rustc: null, cargo: null, rustcCmd: null, cargoCmd: null, binDir: null };
          cachedAt = Date.now();
          return cached;
        })
        .finally(() => {
          detecting = null;
        });
    }
    return detecting;
  }

  const childEnv = (tc) => {
    // Global build tweaks of the learner's machine (-D warnings, sccache, cross targets…) must not
    // change how lesson code behaves. Windows env names are case-insensitive, hence toUpperCase.
    const drop = new Set([
      'RUST_BACKTRACE', 'CARGO_TERM_COLOR', 'CARGO_TERM_PROGRESS_WHEN', 'CARGO_TARGET_DIR', 'CARGO_BUILD_TARGET',
      'CARGO_BUILD_TARGET_DIR', 'RUSTC_WRAPPER', 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'CARGO_BUILD_RUSTFLAGS',
    ]);
    const env = withPath(baseEnv, tc.binDir);
    for (const k of Object.keys(env)) if (drop.has(k.toUpperCase())) delete env[k];
    env.RUST_BACKTRACE = '0';
    env.CARGO_TERM_COLOR = 'never';
    env.CARGO_TERM_PROGRESS_WHEN = 'never';
    env.CARGO_TARGET_DIR = path.join(sandboxDir, 'target');
    return env;
  };

  const result = (t0, backend, patch = {}) => ({
    ok: false,
    stdout: '',
    stderr: '',
    compileError: false,
    timedOut: false,
    durationMs: Date.now() - t0,
    backend,
    ...patch,
  });

  // ---- local, std-only: rustc in a throwaway directory
  let linkerBroken = false;

  async function runLocal(req, tc, t0) {
    await fsp.mkdir(tempDir, { recursive: true });
    const dir = await fsp.mkdtemp(path.join(tempDir, 'rusteach-run-'));
    try {
      const isLib = req.crateType === 'lib';
      const src = isLib ? 'src/lib.rs' : 'src/main.rs';
      await fsp.mkdir(path.join(dir, 'src'));
      await fsp.writeFile(path.join(dir, src), req.code, 'utf8');
      const exe = 'prog' + EXE;
      const base = ['--edition', EDITION, '--crate-name', 'rusteach', '--color', 'never'];
      const checkOnly = req.mode === 'compile' || (isLib && req.mode === 'run');
      const args = checkOnly
        ? [...base, '--crate-type', req.crateType, '--emit=metadata', '-o', 'out.rmeta', src]
        : req.mode === 'test'
          ? [...base, '--test', '-o', exe, src]
          : [...base, '--crate-type', 'bin', '-o', exe, src];
      const env = childEnv(tc);
      const c = await exec(tc.rustcCmd, args, { cwd: dir, env, timeoutMs: limits.compileMs });
      if (c.error) return result(t0, 'local', { infraError: `rustc çalıştırılamadı: ${c.error.message}` });
      const compileOut = normalizePaths(c.stderr);
      if (c.timedOut) {
        return result(t0, 'local', { stderr: cleanCompilerOutput(compileOut), timedOut: true, infraError: 'Derleme zaman aşımına uğradı.' });
      }
      if (c.code !== 0) {
        if (isLinkerMissing(compileOut)) {
          linkerBroken = true;
          return result(t0, 'local', { stderr: cleanCompilerOutput(compileOut), infraError: MSG.linkerMissing, linker: true });
        }
        return result(t0, 'local', { stderr: cleanCompilerOutput(compileOut), compileError: true });
      }
      if (checkOnly) return result(t0, 'local', { ok: true, stderr: cleanCompilerOutput(compileOut) });

      const r = await exec(path.join(dir, exe), req.mode === 'test' ? ['--test-threads=1'] : [], {
        cwd: dir,
        env,
        stdin: req.stdin,
        timeoutMs: limits.runMs,
      });
      if (r.error) return result(t0, 'local', { infraError: `Program başlatılamadı: ${r.error.message}` });
      return result(t0, 'local', {
        ok: r.code === 0 && !r.timedOut && !r.truncated,
        stdout: normalizePaths(r.stdout),
        stderr: cleanCompilerOutput(joinOutput(compileOut, normalizePaths(r.stderr), r.truncated ? MSG.outputCapped : '')),
        timedOut: r.timedOut,
      });
    } finally {
      fsp.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
    }
  }

  // ---- local, with crates: one persistent cargo project, jobs serialized
  let queue = Promise.resolve();
  const enqueue = (job) => {
    const p = queue.then(job, job);
    queue = p.catch(() => {});
    return p;
  };

  const manifestHash = crypto.createHash('sha1').update(SANDBOX_MANIFEST).digest('hex').slice(0, 12);
  const warmFile = () => path.join(sandboxDir, '.rusteach-warm');
  let warming = null;
  let warmFailedAt = 0;

  async function ensureSandbox() {
    await fsp.mkdir(path.join(sandboxDir, 'src'), { recursive: true });
    const manifest = path.join(sandboxDir, 'Cargo.toml');
    let current = null;
    try {
      current = await fsp.readFile(manifest, 'utf8');
    } catch {
      /* first use */
    }
    if (current !== SANDBOX_MANIFEST) await fsp.writeFile(manifest, SANDBOX_MANIFEST, 'utf8');
  }

  async function writeSandboxSource(isLib, code) {
    const main = path.join(sandboxDir, 'src', 'main.rs');
    const lib = path.join(sandboxDir, 'src', 'lib.rs');
    await fsp.writeFile(isLib ? lib : main, code, 'utf8');
    await fsp.rm(isLib ? main : lib, { force: true }); // cargo would build both targets otherwise
  }

  const warmKey = (tc) => `${manifestHash} ${tc.rustc} ${tc.cargo}`;

  function isWarm(tc) {
    try {
      return fs.readFileSync(warmFile(), 'utf8').trim() === warmKey(tc);
    } catch {
      return false;
    }
  }

  /** Downloads and compiles the sandbox crates in the background (first use takes a few minutes). */
  function warmSandbox(tc) {
    if (warming || isWarm(tc) || Date.now() - warmFailedAt < 10 * 60_000) return warming;
    warming = enqueue(async () => {
      if (isWarm(tc)) return true;
      await ensureSandbox();
      await writeSandboxSource(false, 'fn main() {}\n');
      const env = childEnv(tc);
      for (const sub of ['build', 'check']) {
        const r = await exec(tc.cargoCmd, [sub, '--quiet'], { cwd: sandboxDir, env, timeoutMs: limits.warmupMs });
        if (r.error || r.code !== 0) {
          log(`sandbox warm-up (${sub}) failed`, r.error ?? r.stderr);
          warmFailedAt = Date.now();
          return false;
        }
      }
      await fsp.writeFile(warmFile(), warmKey(tc), 'utf8');
      return true;
    }).finally(() => {
      warming = null;
    });
    return warming;
  }

  function runSandbox(req, tc, t0) {
    return enqueue(async () => {
      await ensureSandbox();
      const isLib = req.crateType === 'lib';
      await writeSandboxSource(isLib, req.code);
      const env = childEnv(tc);
      const checkOnly = req.mode === 'compile' || (isLib && req.mode === 'run');
      const sub = checkOnly ? ['check'] : req.mode === 'test' ? ['test', '--no-run'] : ['build'];
      const b = await exec(tc.cargoCmd, [...sub, '--quiet', '--message-format=json-render-diagnostics'], {
        cwd: sandboxDir,
        env,
        timeoutMs: limits.cargoMs,
        maxOutput: limits.cargoJson,
      });
      if (b.error) return result(t0, 'local', { infraError: `cargo çalıştırılamadı: ${b.error.message}` });
      const buildOut = normalizePaths(b.stderr);
      if (b.timedOut) return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), timedOut: true, infraError: MSG.buildTimedOut });
      if (b.code !== 0) {
        if (isCompileError(buildOut) && !isNetworkFailure(buildOut)) {
          return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), compileError: true });
        }
        if (isNetworkFailure(buildOut)) return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), infraError: MSG.crateDownload });
        if (isLinkerMissing(buildOut)) {
          linkerBroken = true;
          return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), infraError: MSG.linkerMissing, linker: true });
        }
        const firstError = buildOut.split('\n').find((l) => l.startsWith('error')) ?? 'bilinmeyen hata';
        return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), infraError: `Yerel derleme ortamında bir sorun oluştu: ${firstError}` });
      }
      if (checkOnly) return result(t0, 'local', { ok: true, stderr: cleanCompilerOutput(buildOut) });

      const exe = findExecutable(b.stdout, req.mode === 'test');
      if (!exe) return result(t0, 'local', { stderr: cleanCompilerOutput(buildOut), infraError: 'Derlenen program bulunamadı.' });
      const r = await exec(exe, req.mode === 'test' ? ['--test-threads=1'] : [], {
        cwd: sandboxDir,
        env,
        stdin: req.stdin,
        timeoutMs: limits.runMs,
      });
      if (r.error) return result(t0, 'local', { infraError: `Program başlatılamadı: ${r.error.message}` });
      return result(t0, 'local', {
        ok: r.code === 0 && !r.timedOut && !r.truncated,
        stdout: normalizePaths(r.stdout),
        stderr: cleanCompilerOutput(joinOutput(buildOut, normalizePaths(r.stderr), r.truncated ? MSG.outputCapped : '')),
        timedOut: r.timedOut,
      });
    });
  }

  // ---- online: Rust Playground
  async function runPlayground(req, t0) {
    const base = { channel: 'stable', mode: 'debug', edition: EDITION, crateType: req.crateType, code: req.code, backtrace: false };
    const endpoint = req.mode === 'compile' ? 'compile' : 'execute';
    const body =
      req.mode === 'compile'
        ? { ...base, tests: false, target: 'mir', assemblyFlavor: 'att', demangleAssembly: 'demangle', processAssembly: 'filter' }
        : { ...base, tests: req.mode === 'test' };
    if (typeof fetchImpl !== 'function') return result(t0, 'online', { infraError: MSG.playgroundUnreachable });

    const deadline = t0 + limits.playgroundMs;
    let lastProblem = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) break;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), remaining);
      let status = 0;
      let text = '';
      try {
        const res = await fetchImpl(`${playgroundUrl}/${endpoint}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        status = res.status;
        text = await res.text();
      } catch (e) {
        if (ctrl.signal.aborted) return result(t0, 'online', { infraError: MSG.playgroundSlow });
        log('playground request failed', e);
        return result(t0, 'online', { infraError: MSG.playgroundUnreachable });
      } finally {
        clearTimeout(timer);
      }
      let j = null;
      try {
        j = JSON.parse(text);
      } catch {
        /* HTML error page from a proxy / load balancer */
      }
      if (j && typeof j.success === 'boolean') {
        const stdout = typeof j.stdout === 'string' ? j.stdout : '';
        const stderr = typeof j.stderr === 'string' ? j.stderr : '';
        return result(t0, 'online', {
          ok: j.success,
          stdout,
          stderr: cleanCompilerOutput(stderr),
          compileError: !j.success && isCompileError(stderr, stdout),
          timedOut: /timed out|Killed/i.test(stderr),
        });
      }
      if (j && typeof j.error === 'string') {
        const msg = j.error;
        if (/timed out|timeout|deadline/i.test(msg)) return result(t0, 'online', { stderr: MSG.playgroundTimeout, timedOut: true });
        if (/bytes of output/i.test(msg)) return result(t0, 'online', { stderr: MSG.playgroundFlood });
        if (status !== 429 && status < 500) return result(t0, 'online', { infraError: `Rust Playground isteği tamamlayamadı: ${msg}` });
        lastProblem = msg;
      } else {
        lastProblem = `HTTP ${status}`;
      }
      if (status !== 429 && status < 500) break;
      await sleep(Math.min(1000 * 2 ** attempt, Math.max(0, deadline - Date.now() - 1500)));
    }
    return result(t0, 'online', {
      infraError: `Rust Playground şu an yanıt vermiyor (${lastProblem || 'bilinmeyen hata'}). Biraz sonra tekrar dene ya da Rust'ı bilgisayarına kur.`,
    });
  }

  // ---- dispatcher
  const strip = (r) => {
    delete r.linker;
    return r;
  };

  /** auto mode: the local toolchain could not run the code at all - try the Playground instead. */
  async function viaPlaygroundOr(req, local) {
    const online = await runPlayground(req, Date.now());
    return online.infraError ? strip(local) : online;
  }

  async function run(raw) {
    const t0 = Date.now();
    const { req, error } = normalizeRequest(raw);
    if (!req) return result(t0, raw?.backend === 'online' ? 'online' : 'local', { infraError: error });

    if (req.backend === 'online') return runPlayground(req, t0);

    const tc = await toolchain();
    const needsCargo = req.crates.length > 0;

    const oldRustc = tooOldFor2024(tc.rustc);
    const oldCargo = tooOldFor2024(tc.cargo);

    if (req.backend === 'local') {
      if (!tc.rustc) return result(t0, 'local', { infraError: MSG.rustMissing });
      if (oldRustc) return result(t0, 'local', { infraError: MSG.tooOld(oldRustc) });
      if (!needsCargo) return strip(await runLocal(req, tc, t0));
      if (!tc.cargo) return result(t0, 'local', { infraError: MSG.cargoMissing });
      if (oldCargo) return result(t0, 'local', { infraError: MSG.tooOld(oldCargo) });
      return strip(await runSandbox(req, tc, t0));
    }

    // auto: local when possible, otherwise the Playground
    if (!tc.rustc || oldRustc) return runPlayground(req, t0);
    if (!needsCargo) {
      if (linkerBroken && req.mode !== 'compile') return runPlayground(req, t0);
      const local = await runLocal(req, tc, t0);
      return local.infraError ? viaPlaygroundOr(req, local) : strip(local);
    }
    const sandboxable = tc.cargo && !oldCargo && req.crates.every((c) => c in SANDBOX_DEPS);
    if (!sandboxable || (linkerBroken && req.mode !== 'compile')) return runPlayground(req, t0);
    if (!isWarm(tc)) {
      // First crate use: compile the sandbox in the background and answer from the Playground meanwhile.
      warmSandbox(tc);
      const online = await runPlayground(req, t0);
      if (!online.infraError) return online;
      return strip(await runSandbox(req, tc, Date.now())); // offline: wait for the local build instead
    }
    const local = await runSandbox(req, tc, t0);
    return local.infraError ? viaPlaygroundOr(req, local) : strip(local);
  }

  /** Removes run directories left behind by a crash. */
  async function sweepStale(maxAgeMs = 60 * 60_000) {
    let entries = [];
    try {
      entries = await fsp.readdir(tempDir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries
        .filter((e) => e.isDirectory() && e.name.startsWith('rusteach-run-'))
        .map(async (e) => {
          const p = path.join(tempDir, e.name);
          try {
            const st = await fsp.stat(p);
            if (Date.now() - st.mtimeMs > maxAgeMs) await fsp.rm(p, { recursive: true, force: true, maxRetries: 2 });
          } catch {
            /* in use or gone */
          }
        }),
    );
  }

  /** Kills every running compiler/program (app shutdown). */
  function dispose() {
    for (const child of active) killTree(child);
    active.clear();
  }

  return {
    run,
    toolchain,
    warmSandbox: async () => {
      const tc = await toolchain();
      return tc.cargo ? warmSandbox(tc) : false;
    },
    sweepStale,
    dispose,
    paths: { tempDir, sandboxDir },
  };
}

module.exports = {
  EDITION,
  LIMITS,
  SANDBOX_DEPS,
  SANDBOX_MANIFEST,
  NOISE,
  createRunner,
  detectToolchain,
  hasMain,
  cleanCompilerOutput,
  isCompileError,
  normalizePaths,
  detectCrates,
  normalizeRequest,
  findExecutable,
  isLinkerMissing,
  isNetworkFailure,
  tooOldFor2024,
  runProcess,
  killTree,
  withPath,
};
