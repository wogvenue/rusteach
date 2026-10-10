import { Link } from 'react-router-dom';
import { getModule, getTier } from '../../../lib/content';
import { tierVars } from '../RegionBanner';

/** Small tier-colored link to the module where a term or error is taught. */
export default function ModuleChip({ moduleId }: { moduleId?: string }) {
  const m = moduleId ? getModule(moduleId) : undefined;
  if (!m) return null;
  const color = getTier(m.tier)?.color ?? m.color;
  return (
    <Link
      to={`/modul/${m.id}`}
      style={tierVars(color)}
      title={`Modül ${m.number}: ${m.title}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:brightness-110 [border-color:color-mix(in_oklab,var(--tier)_32%,transparent)] [background:color-mix(in_oklab,var(--tier)_11%,transparent)]"
    >
      <span aria-hidden>{m.icon}</span>
      <span className="tier-ink truncate">
        Modül {m.number}: {m.title}
      </span>
    </Link>
  );
}
