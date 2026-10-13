// App shell: collapsible sidebar (bottom tab bar on phones), top bar (Electron drag region),
// animated page transitions and the first-run onboarding.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useProgress } from '../../store/progress';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useIsMobile } from './useIsMobile';
import Onboarding from '../shell/Onboarding';

const SIDEBAR_KEY = 'rusteach-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    if (v !== null) return v === '1';
  } catch {
    /* storage unavailable */
  }
  return typeof window !== 'undefined' && window.innerWidth < 1100;
}

function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }, []);
  return [collapsed, toggle];
}

export default function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const onboarded = useProgress((s) => s.profile.onboarded);
  const [collapsed, toggle] = useSidebarCollapsed();
  const mobile = useIsMobile();
  const main = useRef<HTMLElement>(null);

  // Ctrl+B toggles the sidebar (outside text fields / editors)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b' || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('.cm-editor'))) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="flex h-full overflow-hidden bg-bg text-fg">
      <button
        type="button"
        onClick={() => main.current?.focus()}
        className="no-drag sr-only z-[200] rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        İçeriğe geç
      </button>
      {!mobile && <Sidebar collapsed={collapsed} onToggle={toggle} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden outline-none [scrollbar-gutter:stable]"
          style={mobile ? { paddingBottom: 'var(--bottom-nav-h)' } : undefined}
        >
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => main.current?.scrollTo({ top: 0 })}>
            <motion.div
              key={location.pathname}
              className="min-h-full"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.13, ease: 'easeIn' } }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {mobile && <BottomNav />}
      <Onboarding open={!onboarded} />
    </div>
  );
}
