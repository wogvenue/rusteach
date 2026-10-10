// Profil: avatar, editable name, level and title, the title ladder, achievements and the
// "Rust Yolculuğu Sertifikası".
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useProgress } from '../store/progress';
import ProfileHero from '../components/shell/profile/ProfileHero';
import TitleLadder from '../components/shell/profile/TitleLadder';
import AchievementsSection from '../components/shell/profile/AchievementsSection';
import CertificateSection from '../components/shell/profile/CertificateSection';
import { prefersReducedMotion } from '../components/ui/motion';

export default function ProfilePage() {
  const s = useProgress();
  const { hash } = useLocation();

  // /profil#sertifika (from the dashboard) scrolls to the certificate
  useEffect(() => {
    if (hash !== '#sertifika') return;
    const t = window.setTimeout(() => {
      document.getElementById('sertifika')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }, 320);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="@container mx-auto w-full max-w-[1240px] px-6 pb-14 pt-7 lg:px-8">
      <ProfileHero s={s} />
      <div className="mt-6 grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <AchievementsSection s={s} />
        </div>
        <aside className="@5xl:sticky @5xl:top-6 @5xl:self-start" aria-label="Unvanlar">
          <TitleLadder xp={s.xp} />
        </aside>
      </div>
      <div className="mt-8">
        <CertificateSection s={s} />
      </div>
    </div>
  );
}
