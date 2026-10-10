import type { LucideIcon } from 'lucide-react';
import { BookA, ChartColumn, CircleUser, Dumbbell, House, Layers, Map as MapIcon, Settings, SquareTerminal } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should highlight this item. */
  also?: string[];
  badge?: 'due';
}

/** Sidebar navigation, in groups. */
export const NAV_GROUPS: NavItem[][] = [
  [
    { to: '/', label: 'Ana Sayfa', icon: House },
    { to: '/harita', label: 'Yolculuk Haritası', icon: MapIcon, also: ['/modul/'] },
    { to: '/tekrar', label: 'Tekrar', icon: Layers, badge: 'due' },
    { to: '/antrenman', label: 'Antrenman', icon: Dumbbell },
  ],
  [
    { to: '/istatistik', label: 'İstatistikler', icon: ChartColumn },
    { to: '/oyun-alani', label: 'Oyun Alanı', icon: SquareTerminal },
    { to: '/sozluk', label: 'Sözlük', icon: BookA },
  ],
  [
    { to: '/profil', label: 'Profil', icon: CircleUser },
    { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
  ],
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/';
  if (pathname === item.to || pathname.startsWith(item.to + '/')) return true;
  return !!item.also?.some((p) => pathname.startsWith(p));
}

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Ana Sayfa'],
  [/^\/harita/, 'Yolculuk Haritası'],
  [/^\/modul\//, 'Modül'],
  [/^\/tekrar/, 'Tekrar'],
  [/^\/antrenman/, 'Antrenman'],
  [/^\/istatistik/, 'İstatistikler'],
  [/^\/profil/, 'Profil'],
  [/^\/sozluk/, 'Sözlük'],
  [/^\/oyun-alani/, 'Oyun Alanı'],
  [/^\/ayarlar/, 'Ayarlar'],
];

export function titleForPath(pathname: string): string {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'Ana Sayfa';
}
