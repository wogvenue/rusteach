// Phone navigation: four primary tabs plus a "Daha fazla" sheet holding the rest of NAV_GROUPS.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { Ellipsis } from 'lucide-react';
import { dueReviews, useProgress } from '../../store/progress';
import { useNow } from '../shell/useNow';
import { isNavActive, NAV_GROUPS, type NavItem } from './routes';
import LevelCard from './LevelCard';

const PRIMARY = NAV_GROUPS[0];
const MORE = NAV_GROUPS.slice(1).flat();

export default function BottomNav() {
  const { pathname } = useLocation();
  const now = useNow(60_000);
  const due = useProgress((s) => dueReviews(s, now).length);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((i) => isNavActive(i, pathname));

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="sheet"
              data-back-closes
              aria-label="Diğer sayfalar"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-elevated px-4 pt-3 shadow-pop"
              style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 12px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 420, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
              <ul className="grid grid-cols-3 gap-2">
                {MORE.map((item) => (
                  <li key={item.to}>
                    <SheetEntry item={item} active={isNavActive(item, pathname)} />
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <LevelCard collapsed={false} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-[color-mix(in_oklab,var(--c-surface)_92%,transparent)] backdrop-blur-md"
        style={{ paddingBottom: 'var(--safe-area-inset-bottom,env(safe-area-inset-bottom))' }}
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {PRIMARY.map((item) => (
            <li key={item.to} className="flex-1">
              <TabEntry item={item} active={!moreOpen && isNavActive(item, pathname)} badge={item.badge === 'due' ? due : 0} />
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className={clsx(
                'flex size-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                moreOpen || moreActive ? 'text-accent' : 'text-muted',
              )}
            >
              <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition-colors', (moreOpen || moreActive) && 'bg-accent-soft')}>
                <Ellipsis className="size-5" aria-hidden />
              </span>
              Daha fazla
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function TabEntry({ item, active, badge }: { item: NavItem; active: boolean; badge: number }) {
  const Icon = item.icon;
  const label = item.to === '/harita' ? 'Harita' : item.label;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={badge ? `${label}, ${badge} tekrar bekliyor` : label}
      className={clsx(
        'flex size-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
        active ? 'text-accent' : 'text-muted',
      )}
    >
      <span className="relative grid h-7 w-12 place-items-center">
        {active && (
          <motion.span
            layoutId="tab-active"
            className="absolute inset-0 rounded-full bg-accent-soft"
            transition={{ type: 'spring', stiffness: 520, damping: 40 }}
          />
        )}
        <Icon className="relative size-5" aria-hidden />
        {badge > 0 && (
          <span className="absolute -top-1 right-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

function SheetEntry({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium transition-colors',
        active ? 'border-[color-mix(in_oklab,var(--c-accent)_28%,transparent)] bg-accent-soft text-fg' : 'border-border bg-surface-2/60 text-muted',
      )}
    >
      <Icon className={clsx('size-5', active ? 'text-accent' : 'text-subtle')} aria-hidden />
      {item.label}
    </Link>
  );
}
