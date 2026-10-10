// Pure helpers for exercise checking: forbid/require rules, test failure details, output diff.
import type { ExerciseBlock } from '../../../types/content';

/** Messages for rules the code breaks (forbid matches / require misses). Invalid regexes are ignored. */
export function ruleViolations(code: string, block: Pick<ExerciseBlock, 'forbid' | 'require'>): string[] {
  const out: string[] = [];
  const test = (pattern: string) => {
    try {
      return new RegExp(pattern, 'm').test(code);
    } catch {
      return null;
    }
  };
  for (const r of block.forbid) if (test(r.pattern) === true) out.push(r.message);
  for (const r of block.require) if (test(r.pattern) === false) out.push(r.message);
  return out;
}

/** Panic message of each failed test from `cargo test` stdout, keyed by test name (module prefix removed). */
export function failureDetails(stdout: string): Record<string, string> {
  const details: Record<string, string> = {};
  const text = stdout.replace(/\r\n/g, '\n');
  const re = /^---- (\S+) stdout ----\n([\s\S]*?)(?=^---- \S+ stdout ----$|^failures:$|^test result:|(?![\s\S]))/gm;
  for (const m of text.matchAll(re)) {
    const name = m[1].replace(/^rusteach_tests::/, '');
    const body = m[2]
      .split('\n')
      .filter((l) => !/^note: run with `RUST_BACKTRACE/.test(l))
      .map((l) => l.replace(/^thread '[^']*' panicked at [^:\n]+:\d+:\d+:$/, ''))
      .join('\n')
      .trim();
    if (body) details[name] = body;
  }
  return details;
}

/** "uzunlugu_dogru_hesaplar" -> "uzunlugu dogru hesaplar" */
export function prettyTestName(name: string): string {
  return name.replace(/^rusteach_tests::/, '').replace(/_+/g, ' ').trim();
}

export interface DiffRow {
  expected: string | null;
  actual: string | null;
  same: boolean;
}

/** Line-by-line comparison (trailing spaces ignored, like normalizeOutput). */
export function diffLines(expected: string, actual: string): DiffRow[] {
  const norm = (s: string) =>
    s
      .replace(/\r\n/g, '\n')
      .replace(/\n+$/, '')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''));
  const e = expected ? norm(expected) : [];
  const a = actual ? norm(actual) : [];
  const rows: DiffRow[] = [];
  for (let i = 0; i < Math.max(e.length, a.length); i++) {
    const ex = i < e.length ? e[i] : null;
    const ac = i < a.length ? a[i] : null;
    rows.push({ expected: ex, actual: ac, same: ex === ac });
  }
  return rows;
}
