// Levels & titles. Total XP needed to REACH level n: 50 * n * (n - 1)  (L2 = 100, L5 = 1000, L10 = 4500, L20 = 19000).

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  current: number; // xp into this level
  needed: number; // xp span of this level
  progress: number; // 0..1
  nextAt: number; // total xp for next level
}

const TITLES: { from: number; title: string; emoji: string }[] = [
  { from: 1, title: 'Yumurta', emoji: '🥚' },
  { from: 2, title: 'Yavru Yengeç', emoji: '🦀' },
  { from: 4, title: 'Kum Gezgini', emoji: '🏖️' },
  { from: 7, title: 'Kabuk Kırıcı', emoji: '🐚' },
  { from: 10, title: 'Borrow Çırağı', emoji: '📜' },
  { from: 14, title: 'Trait Ustası', emoji: '🧩' },
  { from: 18, title: 'Lifetime Bilgesi', emoji: '⏳' },
  { from: 22, title: 'Eşzamanlılık Şövalyesi', emoji: '⚔️' },
  { from: 26, title: 'Unsafe Terbiyecisi', emoji: '🔥' },
  { from: 30, title: 'Rustacean Efsanesi', emoji: '👑' },
];

export function titleForLevel(level: number) {
  let t = TITLES[0];
  for (const x of TITLES) if (level >= x.from) t = x;
  return t;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const nextAt = xpForLevel(level + 1);
  const t = titleForLevel(level);
  return {
    level,
    title: t.title,
    emoji: t.emoji,
    current: xp - base,
    needed: nextAt - base,
    progress: (xp - base) / (nextAt - base),
    nextAt,
  };
}
