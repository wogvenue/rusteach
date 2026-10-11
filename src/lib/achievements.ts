// Achievement definitions + the watcher hook mounted once at the app root.
// Achievements reward the behaviours that make learning stick (spaced reviews, explaining in
// your own words, fixing mistakes, honest confidence ratings) - not just raw grinding.
import { useEffect } from 'react';
import { useProgress, type ProgressData } from '../store/progress';
import { toast } from '../store/ui';
import { getLesson, modules, modulesOfTier, tiers } from './content';
import { levelInfo, xpForLevel } from './xp';
import { play } from './sound';
import { celebrateBig } from './celebrate';

export type AchievementCategory = 'yol' | 'kod' | 'sinav' | 'bolge' | 'aliskanlik' | 'hafiza' | 'ustbilis' | 'gizli';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  secret?: boolean;
  category: AchievementCategory;
  check: (s: ProgressData) => boolean;
  /** Optional progress towards the goal, shown on locked tiles. */
  progress?: (s: ProgressData) => { value: number; target: number };
}

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  yol: 'Yolculuk',
  kod: 'Kod',
  sinav: 'Sınavlar',
  bolge: 'Bölgeler',
  aliskanlik: 'Alışkanlık',
  hafiza: 'Hafıza',
  ustbilis: 'Öğrenmeyi öğrenmek',
  gizli: 'Gizli',
};

// ------------------------------------------------------------------ counters

const completedLessons = (s: ProgressData) =>
  Object.entries(s.lessons).filter(([id, l]) => l.status === 'completed' && getLesson(id)?.type !== 'boss').length;
const completedProjects = (s: ProgressData) =>
  Object.entries(s.lessons).filter(([id, l]) => l.status === 'completed' && getLesson(id)?.type === 'project').length;
const solved = (s: ProgressData) => Object.values(s.exercises).filter((e) => e.solved).length;
const solvedNoHelp = (s: ProgressData) =>
  Object.values(s.exercises).filter((e) => e.solved && e.hintsUsed === 0 && !e.usedSolution).length;
const bossesPassed = (s: ProgressData) => Object.values(s.modules).filter((m) => m.bossPassed).length;
const learnedCards = (s: ProgressData) => Object.values(s.srs).filter((e) => e.kind === 'flashcard' && e.card.state >= 2).length;
const resolvedMistakes = (s: ProgressData) => Object.values(s.mistakes).filter((m) => m.resolved).length;
const goalDays = (s: ProgressData) => Object.values(s.activity).filter((d) => d.goalBonus).length;
const notesWritten = (s: ProgressData) => Object.values(s.notes).filter((t) => t.trim().length >= 10).length;
const masteredIn = (s: ProgressData, tierId: string) => modulesOfTier(tierId).filter((m) => s.modules[m.id]?.bossPassed).length;

const hoursOfActivity = (s: ProgressData) => s.recentXp.map((e) => new Date(e.at).getHours());

function lastConfident(s: ProgressData, n: number) {
  return Object.values(s.blocks)
    .filter((b) => b.confidence === 3)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, n);
}

function studiedWholeWeekend(s: ProgressData): boolean {
  for (const key of Object.keys(s.activity)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() !== 6) continue; // Saturday
    const sunday = new Date(y, m - 1, d + 1);
    const sk = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    const a = s.activity[key];
    const b = s.activity[sk];
    if (a && b && (a.xp > 0 || a.checks > 0 || a.reviews > 0) && (b.xp > 0 || b.checks > 0 || b.reviews > 0)) return true;
  }
  return false;
}

const count = (fn: (s: ProgressData) => number, target: number) => ({
  check: (s: ProgressData) => fn(s) >= target,
  progress: (s: ProgressData) => ({ value: Math.min(fn(s), target), target }),
});

// ------------------------------------------------------------------ tier achievements

const TIER_TITLES: Record<string, string> = {
  t1: 'Koyun Fatihi',
  t2: 'Adanın Efendisi',
  t3: 'Liman Kaptanı',
  t4: 'Orman Bekçisi',
  t5: 'Vadinin Gezgini',
  t6: 'Dağların Hâkimi',
  t7: 'Kanyon Kâşifi',
  t8: 'Zirvedeki Rustacean',
};

const tierAchievements: AchievementDef[] = tiers.map((t) => ({
  id: `tier-${t.id}`,
  title: TIER_TITLES[t.id] ?? `${t.title} Ustası`,
  description: `${t.title} bölgesindeki tüm modüllerde ustalaş.`,
  icon: t.emoji,
  category: 'bolge' as const,
  check: (s: ProgressData) => modulesOfTier(t.id).length > 0 && masteredIn(s, t.id) === modulesOfTier(t.id).length,
  progress: (s: ProgressData) => ({ value: masteredIn(s, t.id), target: Math.max(1, modulesOfTier(t.id).length) }),
}));

// ------------------------------------------------------------------ definitions

export const ACHIEVEMENTS: AchievementDef[] = [
  // yolculuk
  { id: 'first-lesson', title: 'İlk Adım', description: 'İlk dersini tamamla.', icon: '👣', category: 'yol', ...count(completedLessons, 1) },
  { id: 'lessons-10', title: 'Ders Kurdu', description: '10 ders tamamla.', icon: '📚', category: 'yol', ...count(completedLessons, 10) },
  { id: 'lessons-50', title: 'Azimli Öğrenci', description: '50 ders tamamla.', icon: '🎒', category: 'yol', ...count(completedLessons, 50) },
  { id: 'first-project', title: 'İlk Proje', description: 'Bir proje dersini baştan sona bitir.', icon: '🏗️', category: 'yol', ...count(completedProjects, 1) },
  {
    id: 'perfect-lesson',
    title: 'Sıfır Hata',
    description: 'Bir dersin bütün sorularını ilk denemede doğru cevapla.',
    icon: '🌟',
    category: 'yol',
    check: (s) => Object.values(s.lessons).some((l) => l.status === 'completed' && l.accuracy === 1),
  },
  {
    id: 'journey',
    title: 'Rust Yolculuğu Tamam',
    description: 'Tüm modüllerde ustalaş ve sertifikanı al.',
    icon: '👑',
    category: 'yol',
    check: (s) => modules.length > 0 && modules.every((m) => s.modules[m.id]?.bossPassed),
    progress: (s) => ({ value: bossesPassed(s), target: Math.max(1, modules.length) }),
  },

  // kod
  { id: 'first-exercise', title: 'Merhaba, Derleyici', description: 'İlk kod alıştırmanı çöz.', icon: '⌨️', category: 'kod', ...count(solved, 1) },
  { id: 'exercises-10', title: 'Isınma Turu', description: '10 alıştırma çöz.', icon: '🔨', category: 'kod', ...count(solved, 10) },
  { id: 'exercises-50', title: 'Kod Zanaatkârı', description: '50 alıştırma çöz.', icon: '🛠️', category: 'kod', ...count(solved, 50) },
  { id: 'exercises-100', title: 'Yüzlük', description: '100 alıştırma çöz.', icon: '💯', category: 'kod', ...count(solved, 100) },
  {
    id: 'no-help-10',
    title: 'Kendi Başına',
    description: 'İpucu ya da çözüm kullanmadan 10 alıştırma çöz.',
    icon: '🧩',
    category: 'kod',
    ...count(solvedNoHelp, 10),
  },

  // sınavlar
  { id: 'first-boss', title: 'İlk Zafer', description: 'İlk modül sınavını geç.', icon: '⚔️', category: 'sinav', ...count(bossesPassed, 1) },
  {
    id: 'perfect-boss',
    title: 'Kusursuz',
    description: 'Bir modül sınavını %100 ile geç.',
    icon: '💎',
    category: 'sinav',
    check: (s) => Object.values(s.modules).some((m) => m.bossPassed && m.bossBest >= 1),
  },
  {
    id: 'skip-test',
    title: 'Kestirme Yol',
    description: 'Bir atlama sınavını geçerek modülün kilidini aç.',
    icon: '🚀',
    category: 'sinav',
    check: (s) => Object.values(s.modules).some((m) => m.skipUnlocked),
  },
  { id: 'bosses-10', title: 'Sınav Avcısı', description: '10 modül sınavını geç.', icon: '🏆', category: 'sinav', ...count(bossesPassed, 10) },

  // bölgeler
  ...tierAchievements,

  // alışkanlık
  {
    id: 'streak-3',
    title: 'Kıvılcım',
    description: '3 gün üst üste çalış.',
    icon: '🔥',
    category: 'aliskanlik',
    ...count((s) => s.streak.best, 3),
  },
  { id: 'streak-7', title: 'Haftalık Seri', description: '7 gün üst üste çalış.', icon: '✨', category: 'aliskanlik', ...count((s) => s.streak.best, 7) },
  {
    id: 'streak-30',
    title: 'Alışkanlık Ustası',
    description: '30 gün üst üste çalış.',
    icon: '🗓️',
    category: 'aliskanlik',
    ...count((s) => s.streak.best, 30),
  },
  {
    id: 'streak-100',
    title: 'Sönmeyen Ateş',
    description: '100 gün üst üste çalış.',
    icon: '🌋',
    category: 'aliskanlik',
    ...count((s) => s.streak.best, 100),
  },
  { id: 'goal-1', title: 'Tam İsabet', description: 'Günlük hedefini ilk kez tamamla.', icon: '🎯', category: 'aliskanlik', ...count(goalDays, 1) },
  {
    id: 'goal-7',
    title: 'Hedef Odaklı',
    description: 'Günlük hedefini 7 farklı gün tamamla.',
    icon: '📆',
    category: 'aliskanlik',
    ...count(goalDays, 7),
  },
  {
    id: 'study-10h',
    title: 'On Saatlik Emek',
    description: 'Rusteach’te toplam 10 saat çalış.',
    icon: '⏳',
    category: 'aliskanlik',
    check: (s) => s.totalSeconds >= 36_000,
    progress: (s) => ({ value: Math.min(10, Math.floor(s.totalSeconds / 3600)), target: 10 }),
  },

  // hafıza
  { id: 'reviews-100', title: 'Hafıza Bahçıvanı', description: '100 tekrar yap.', icon: '🌱', category: 'hafiza', ...count((s) => s.reviewLog.length, 100) },
  {
    id: 'reviews-1000',
    title: 'Hafıza Sarayı',
    description: '1000 tekrar yap.',
    icon: '🏛️',
    category: 'hafiza',
    ...count((s) => s.reviewLog.length, 1000),
  },
  {
    id: 'cards-50',
    title: 'Kart Koleksiyoncusu',
    description: '50 kartı uzun süreli belleğine taşı.',
    icon: '🃏',
    category: 'hafiza',
    ...count(learnedCards, 50),
  },
  {
    id: 'xp-1000',
    title: 'Bin Volt',
    description: 'Toplam 1.000 XP kazan.',
    icon: '⚡',
    category: 'hafiza',
    ...count((s) => s.xp, 1000),
  },
  {
    id: 'level-10',
    title: 'Onuncu Seviye',
    description: '10. seviyeye ulaş.',
    icon: '📜',
    category: 'hafiza',
    check: (s) => s.xp >= xpForLevel(10),
    progress: (s) => ({ value: Math.min(s.xp, xpForLevel(10)), target: xpForLevel(10) }),
  },

  // öğrenmeyi öğrenmek
  {
    id: 'reflect-10',
    title: 'Kendi Cümlelerinle',
    description: '10 kavramı kendi cümlelerinle açıkla.',
    icon: '✍️',
    category: 'ustbilis',
    ...count((s) => Object.keys(s.reflections).length, 10),
  },
  {
    id: 'mistakes-10',
    title: 'Hata Avcısı',
    description: 'Yanlış yaptığın 10 soruyu sonradan doğru çöz.',
    icon: '🐞',
    category: 'ustbilis',
    ...count(resolvedMistakes, 10),
  },
  {
    id: 'calibrated',
    title: 'Kalibre',
    description: '“Çok emindim” dediğin son 20 cevabın hepsi ilk denemede doğru olsun.',
    icon: '🎚️',
    category: 'ustbilis',
    check: (s) => {
      const last = lastConfident(s, 20);
      return last.length >= 20 && last.every((b) => b.firstTry);
    },
    progress: (s) => {
      let streak = 0;
      for (const b of lastConfident(s, 20)) {
        if (!b.firstTry) break;
        streak++;
      }
      return { value: streak, target: 20 };
    },
  },
  {
    id: 'notes-5',
    title: 'Not Defteri',
    description: '5 farklı derse kendi notlarını yaz.',
    icon: '📝',
    category: 'ustbilis',
    ...count(notesWritten, 5),
  },

  // gizli
  {
    id: 'night-owl',
    title: 'Gece Kuşu',
    description: 'Gece 23.00’ten sonra çalıştın. Uykunu da unutma!',
    icon: '🦉',
    category: 'gizli',
    secret: true,
    check: (s) => hoursOfActivity(s).some((h) => h >= 23 || h < 4),
  },
  {
    id: 'early-bird',
    title: 'Erkenci Kuş',
    description: 'Sabah 07.00’den önce çalıştın.',
    icon: '🐦',
    category: 'gizli',
    secret: true,
    check: (s) => hoursOfActivity(s).some((h) => h >= 4 && h < 7),
  },
  {
    id: 'hypercorrection',
    title: 'Yanılgıya Veda',
    description: 'Çok emin olduğun bir yanlışı sonradan düzelttin. En kalıcı öğrenme budur.',
    icon: '💡',
    category: 'gizli',
    secret: true,
    check: (s) => Object.values(s.blocks).some((b) => b.confidence === 3 && !b.firstTry && b.correct),
  },
  {
    id: 'weekend',
    title: 'Hafta Sonu Mesaisi',
    description: 'Bir hafta sonunun hem cumartesi hem pazar günü çalıştın.',
    icon: '☕',
    category: 'gizli',
    secret: true,
    check: studiedWholeWeekend,
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

function safeCheck(a: AchievementDef, s: ProgressData): boolean {
  try {
    return a.check(s);
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ watcher

/** Mounted once at the app root: unlocks achievements when progress changes and shows a toast. */
export function useAchievementWatcher(): void {
  useEffect(() => {
    // Level-ups are measured against the level at mount, so opening the app never celebrates.
    let prevLevel = levelInfo(useProgress.getState().xp).level;
    let timer: number | undefined;

    const evaluate = () => {
      const s = useProgress.getState();

      // level-ups
      const info = levelInfo(s.xp);
      let leveled = false;
      if (info.level > prevLevel) {
        leveled = true;
        const oldTitle = levelInfo(xpForLevel(prevLevel)).title;
        toast({
          kind: 'level',
          title: `Seviye ${info.level}`,
          description:
            oldTitle !== info.title
              ? `Yeni unvanın: ${info.title}. Bir sonraki seviyeye ${(info.needed - info.current).toLocaleString('tr-TR')} XP var.`
              : `Bir sonraki seviyeye ${(info.needed - info.current).toLocaleString('tr-TR')} XP var.`,
          icon: info.emoji,
          duration: 5200,
        });
        play('levelUp');
        celebrateBig();
      }
      prevLevel = info.level;

      // achievements
      const fresh = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && safeCheck(a, s));
      if (!fresh.length) return;
      for (const a of fresh) s.unlockAchievement(a.id);
      fresh.slice(0, 3).forEach((a, i) => {
        window.setTimeout(
          () => toast({ kind: 'achievement', title: a.title, description: a.description, icon: a.icon, duration: 5600 }),
          (leveled ? 700 : 0) + i * 420,
        );
      });
      if (fresh.length > 3) {
        window.setTimeout(
          () =>
            toast({
              kind: 'info',
              icon: '🏅',
              title: `${fresh.length - 3} başarım daha açıldı`,
              description: 'Hepsini Profil sayfasında görebilirsin.',
              duration: 5000,
            }),
          (leveled ? 700 : 0) + 3 * 420,
        );
      }
      if (!leveled) play('achievement');
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, 450);
    };
    const unsub = useProgress.subscribe(schedule);
    timer = window.setTimeout(evaluate, 1200); // initial pass (e.g. achievements added in an update)
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
}
