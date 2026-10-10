// Route table. Owned by the shell/UI agent for visual changes, but routes are a shared contract:
//   /                    Dashboard           (shell)
//   /harita              MapPage             (shell)   journey map of tiers & modules
//   /modul/:moduleId     ModulePage          (shell)
//   /ders/:lessonId      LessonPage          (lesson)  focus mode, outside the shell; boss too.
//                                                     ?atlama=1 -> boss taken as a skip/placement test
//   /tekrar              ReviewPage          (learn)   spaced repetition session
//   /antrenman           PracticePage        (learn)   interleaved practice + mistakes notebook
//   /istatistik          StatsPage           (learn)
//   /profil              ProfilePage         (shell)   level, achievements
//   /sozluk              GlossaryPage        (shell)   glossary + compiler error guide
//   /oyun-alani          PlaygroundPage      (lesson)  free Rust scratchpad
//   /ayarlar             SettingsPage        (shell)
import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import ModulePage from './pages/ModulePage';
import LessonPage from './pages/LessonPage';
import ReviewPage from './pages/ReviewPage';
import PracticePage from './pages/PracticePage';
import StatsPage from './pages/StatsPage';
import ProfilePage from './pages/ProfilePage';
import GlossaryPage from './pages/GlossaryPage';
import PlaygroundPage from './pages/PlaygroundPage';
import SettingsPage from './pages/SettingsPage';
import { useProgress } from './store/progress';
import Toaster from './components/ui/Toaster';
import { useAchievementWatcher } from './lib/achievements';

function useThemeSync() {
  const theme = useProgress((s) => s.settings.theme);
  const reduced = useProgress((s) => s.settings.reducedMotion);
  const scale = useProgress((s) => s.settings.contentScale);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      window.rusteach?.setTitleBarTheme?.(dark ? 'dark' : 'light');
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  useEffect(() => {
    document.documentElement.style.setProperty('--content-scale', String(scale));
  }, [scale]);
}

export default function App() {
  useThemeSync();
  useAchievementWatcher();
  const reducedMotion = useProgress((s) => s.settings.reducedMotion);
  return (
    // Shell wrapper: framer-motion honours the in-app "Hareketi azalt" setting (and the OS setting).
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <HashRouter>
        <Toaster />
        <Routes>
          <Route path="/ders/:lessonId" element={<LessonPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/harita" element={<MapPage />} />
            <Route path="/modul/:moduleId" element={<ModulePage />} />
            <Route path="/tekrar" element={<ReviewPage />} />
            <Route path="/antrenman" element={<PracticePage />} />
            <Route path="/istatistik" element={<StatsPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/sozluk" element={<GlossaryPage />} />
            <Route path="/oyun-alani" element={<PlaygroundPage />} />
            <Route path="/ayarlar" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </HashRouter>
    </MotionConfig>
  );
}
