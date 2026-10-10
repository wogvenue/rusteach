import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getModule } from '../../lib/content';
import { titleForPath } from './routes';
import FocusTimer from './FocusTimer';
import RunnerChip from './RunnerChip';
import StreakButton from './StreakButton';
import DailyGoalButton from './DailyGoalButton';
import XpCounter from './XpCounter';

/** Space kept free for the Windows title bar overlay buttons in Electron. */
const OVERLAY_WIDTH = 140;

export default function TopBar() {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);
  const moduleId = pathname.startsWith('/modul/') ? decodeURIComponent(pathname.split('/')[2] ?? '') : null;
  const mod = moduleId ? getModule(moduleId) : undefined;

  useEffect(() => {
    document.title = `${mod ? mod.title : title} – Rusteach`;
  }, [title, mod]);

  return (
    <header
      className="drag-region relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-[color-mix(in_oklab,var(--c-bg)_82%,transparent)] pl-6 backdrop-blur-md"
      style={{ paddingRight: window.rusteach ? OVERLAY_WIDTH + 8 : 16 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {mod ? (
          <>
            <Link to="/harita" className="no-drag shrink-0 rounded-md px-1 font-medium text-muted transition-colors hover:text-fg">
              Yolculuk Haritası
            </Link>
            <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
            <span className="truncate font-semibold text-fg">
              Modül {mod.number}: {mod.title}
            </span>
          </>
        ) : (
          <span className="truncate px-1 font-semibold text-fg">{title}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <FocusTimer />
        <RunnerChip />
        <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
        <StreakButton />
        <DailyGoalButton />
        <XpCounter />
      </div>
    </header>
  );
}
