import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Ferris from '../Ferris';
import { dueReviews, useProgress } from '../../store/progress';
import { Tooltip } from '../ui/Tooltip';
import { useNow } from '../shell/useNow';
import { isNavActive, NAV_GROUPS, type NavItem } from './routes';
import LevelCard from './LevelCard';

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation();
  const now = useNow(60_000);
  const due = useProgress((s) => dueReviews(s, now).length);

  return (
    <aside
      className={clsx(
        'relative z-40 flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out',
        collapsed ? 'w-[76px]' : 'w-[244px]',
      )}
    >
      {/* brand row doubles as the window drag area */}
      <div className={clsx('drag-region flex h-12 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link to="/" className="no-drag flex items-center gap-2 rounded-lg" aria-label="Rusteach ana sayfa">
          <Ferris size={34} animate={false} />
          {!collapsed && <span className="text-[17px] font-bold tracking-[-0.03em] text-fg">Rusteach</span>}
        </Link>
      </div>

      <nav aria-label="Ana menü" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2">
        {NAV_GROUPS.map((group, gi) => (
          <ul key={gi} className={clsx('space-y-0.5', gi > 0 && 'mt-3 border-t border-border pt-3')}>
            {group.map((item) => (
              <li key={item.to}>
                <NavEntry item={item} active={isNavActive(item, pathname)} collapsed={collapsed} badge={item.badge === 'due' ? due : 0} />
              </li>
            ))}
          </ul>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <LevelCard collapsed={collapsed} />
        <Tooltip side="right" content={collapsed ? 'Menüyü genişlet (Ctrl+B)' : 'Menüyü daralt (Ctrl+B)'} className="w-full">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-expanded={!collapsed}
            className={clsx(
              'flex h-9 w-full items-center gap-2 rounded-xl text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg',
              collapsed ? 'justify-center' : 'px-3',
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
            {!collapsed && 'Menüyü daralt'}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}

function NavEntry({ item, active, collapsed, badge }: { item: NavItem; active: boolean; collapsed: boolean; badge: number }) {
  const Icon = item.icon;
  const badgeText = badge > 99 ? '99+' : String(badge);
  const link = (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? `${item.label}${badge ? `, ${badge} tekrar bekliyor` : ''}` : undefined}
      className={clsx(
        'group relative flex h-10 items-center gap-3 rounded-xl text-sm font-medium transition-colors',
        collapsed ? 'w-full justify-center' : 'px-3',
        active ? 'text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl border border-[color-mix(in_oklab,var(--c-accent)_28%,transparent)] bg-accent-soft"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative">
        <Icon className={clsx('size-[19px]', active ? 'text-accent' : 'text-subtle group-hover:text-fg')} aria-hidden />
        {collapsed && badge > 0 && (
          <span className="absolute -right-2.5 -top-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
            {badgeText}
          </span>
        )}
      </span>
      {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
      {!collapsed && badge > 0 && (
        <span
          className="relative rounded-full bg-accent px-2 text-[11px] font-bold leading-5 tabular-nums text-accent-fg"
          aria-label={`${badge} tekrar bekliyor`}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
  return collapsed ? (
    <Tooltip side="right" content={badge ? `${item.label} (${badge})` : item.label} className="w-full">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
