#!/usr/bin/env node
// Quick experiment helper for content authors: compile/run a Rust snippet exactly like the app does
// (Rust Playground, stable, edition 2024) and print the raw compiler output.
//
//   node scripts/rustc.mjs path/to/file.rs            # run (cargo run)
//   node scripts/rustc.mjs path/to/file.rs --test     # cargo test
//   node scripts/rustc.mjs path/to/file.rs --check    # compile only (borrow check etc.)
//   echo 'fn main(){}' | node scripts/rustc.mjs -     # read code from stdin
import fs from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('kullanım: node scripts/rustc.mjs <dosya.rs | -> [--test|--check]');
  process.exit(2);
}
const code = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
const test = rest.includes('--test');
const check = rest.includes('--check');
const crateType = /(^|\n)\s*(pub\s+)?(async\s+)?fn\s+main\s*\(/.test(code) ? 'bin' : 'lib';
const base = { channel: 'stable', mode: 'debug', edition: '2024', crateType, code, backtrace: false };
const body = check
  ? { ...base, tests: false, target: 'mir', assemblyFlavor: 'att', demangleAssembly: 'demangle', processAssembly: 'filter' }
  : { ...base, tests: test };
for (let i = 0; i < 5; i++) {
  try {
    const res = await fetch(`https://play.rust-lang.org/${check ? 'compile' : 'execute'}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.status >= 500 || res.status === 429) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    console.log(`── success: ${j.success}  (${j.exitDetail ?? j.error ?? ''})`);
    console.log('── stderr ──\n' + (j.stderr ?? ''));
    if (!check) console.log('── stdout ──\n' + (j.stdout ?? ''));
    process.exit(j.success ? 0 : 1);
  } catch (e) {
    console.error('deneme', i + 1, 'başarısız:', e.message);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
}
process.exit(3);
