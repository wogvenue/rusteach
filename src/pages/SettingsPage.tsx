// Ayarlar: appearance, sound, learning, code runner (+ Rust install guide), data and about.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BookOpenText, HardDrive, Info, Palette, SquareTerminal, Volume2 } from 'lucide-react';
import { AppearanceSection, LearningSection, SoundSection } from '../components/shell/settings/PreferenceSections';
import RunnerSection from '../components/shell/settings/RunnerSection';
import DataSection from '../components/shell/settings/DataSection';
import AboutSection from '../components/shell/settings/AboutSection';
import { prefersReducedMotion } from '../components/ui/motion';

const SECTIONS = [
  { id: 'gorunum', label: 'Görünüm', icon: Palette },
  { id: 'ses', label: 'Ses', icon: Volume2 },
  { id: 'ogrenme', label: 'Öğrenme', icon: BookOpenText },
  { id: 'calistirma', label: 'Kod çalıştırma', icon: SquareTerminal },
  { id: 'veriler', label: 'Verilerin', icon: HardDrive },
  { id: 'hakkinda', label: 'Hakkında', icon: Info },
];

/** The section whose heading was scrolled past last (or the last one at the very bottom). */
function useActiveSection(): string {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const root = document.getElementById('main');
    if (!root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rootTop = root.getBoundingClientRect().top;
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - rootTop <= 140) current = s.id;
      }
      setActive(atBottom ? SECTIONS[SECTIONS.length - 1].id : current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return active;
}

export default function SettingsPage() {
  const active = useActiveSection();
  return (
    <div className="@container mx-auto w-full max-w-[1120px] px-6 pb-14 pt-7 lg:px-8">
      <header className="mb-6">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-fg">Ayarlar</h1>
        <p className="mt-1.5 text-[15px] text-muted">Değişiklikler hemen uygulanır ve otomatik kaydedilir.</p>
      </header>

      <div className="grid gap-6 @4xl:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Ayar bölümleri" className="hidden @4xl:block">
          <ul className="sticky top-6 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
                  }}
                  className={clsx(
                    'flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors',
                    active === id ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <Icon className={clsx('size-4', active === id ? 'text-accent' : 'text-subtle')} aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <AppearanceSection />
          <SoundSection />
          <LearningSection />
          <RunnerSection />
          <DataSection />
          <AboutSection />
        </div>
      </div>
    </div>
  );
}
