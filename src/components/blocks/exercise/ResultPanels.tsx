// Result views for an exercise check: rule violations, per-test list, expected-vs-actual output.
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CircleCheck, CircleX, ShieldAlert } from 'lucide-react';
import { diffLines, prettyTestName } from './checks';

export function RuleViolations({ messages }: { messages: string[] }) {
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4" role="alert">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-warning">
        <ShieldAlert className="size-4" /> Bu alıştırmanın kuralına uymuyor
      </div>
      <ul className="space-y-1 text-sm text-fg">
        {messages.map((m, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            <span>{m}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Kod çalıştırılmadı. Kuralı karşılayacak şekilde düzenleyip yeniden kontrol et.</p>
    </div>
  );
}

export function TestResults({
  passed,
  failed,
  details,
}: {
  passed: string[];
  failed: string[];
  details: Record<string, string>;
}) {
  const total = passed.length + failed.length;
  const rows = [...failed.map((n) => ({ name: n, ok: false })), ...passed.map((n) => ({ name: n, ok: true }))];
  return (
    <div className="rounded-2xl border border-border bg-surface-2/60">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className={clsx('text-sm font-semibold', failed.length ? 'text-danger' : 'text-success')}>
          {failed.length ? `${failed.length} test geçmedi` : 'Tüm testler geçti'}
        </span>
        <span className="text-xs text-muted">
          {passed.length}/{total} başarılı
        </span>
        <span className="flex-1" />
        <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-danger/25" aria-hidden="true">
          <motion.span
            className="h-full rounded-full bg-success"
            initial={{ width: 0 }}
            animate={{ width: `${total ? (passed.length / total) * 100 : 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <motion.li
            key={r.name}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.05 }}
            className="px-4 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              {r.ok ? (
                <CircleCheck className="size-4 shrink-0 text-success" aria-label="geçti" />
              ) : (
                <CircleX className="size-4 shrink-0 text-danger" aria-label="geçmedi" />
              )}
              <span className={clsx('text-sm', r.ok ? 'text-muted' : 'font-medium text-fg')} title={r.name}>
                {prettyTestName(r.name)}
              </span>
            </div>
            {!r.ok && details[r.name] && (
              <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] px-3 py-2 font-mono text-[0.78rem] leading-relaxed text-[var(--out-error)]">
                {details[r.name]}
              </pre>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function OutputDiff({ expected, actual }: { expected: string; actual: string }) {
  const rows = diffLines(expected, actual);
  const wrong = rows.filter((r) => !r.same).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/60">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold text-danger">Çıktı beklenenden farklı</span>
        <span className="text-xs text-muted">{wrong} satır farklı</span>
      </div>
      <div className="grid grid-cols-2 text-xs font-semibold text-muted">
        <div className="border-b border-r border-border px-4 py-1.5">Beklenen</div>
        <div className="border-b border-border px-4 py-1.5">Senin çıktın</div>
      </div>
      <div className="max-h-72 overflow-auto font-mono text-[0.8rem] leading-relaxed">
        {rows.map((r, i) => (
          <div key={i} className={clsx('grid grid-cols-2', !r.same && 'bg-danger/8')}>
            <div className="whitespace-pre-wrap break-words border-r border-border px-4 py-0.5 text-fg">
              {r.expected === null ? <span className="italic text-subtle">(satır yok)</span> : r.expected || '​'}
            </div>
            <div className={clsx('whitespace-pre-wrap break-words px-4 py-0.5', r.same ? 'text-fg' : 'text-danger')}>
              {r.actual === null ? <span className="italic text-subtle">(satır yok)</span> : r.actual || '​'}
            </div>
          </div>
        ))}
        {!rows.length && <div className="px-4 py-2 italic text-subtle">İki çıktı da boş.</div>}
      </div>
    </div>
  );
}
