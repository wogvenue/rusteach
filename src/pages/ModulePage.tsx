// Modül sayfası: hero, lessons timeline, "Özet Kartı", module exam, practice shortcut and
// previous / next module navigation.
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, Map as MapIcon, ScrollText } from 'lucide-react';
import Ferris from '../components/Ferris';
import { Button } from '../components/ui/Button';
import { Tabs, tabIds } from '../components/ui/Tabs';
import ModuleHero from '../components/shell/module/ModuleHero';
import LessonTimeline from '../components/shell/module/LessonTimeline';
import BossCard from '../components/shell/module/BossCard';
import { ModuleNav, PracticeCard } from '../components/shell/module/ModuleSide';
import { tierVars } from '../components/shell/RegionBanner';
import { moduleStatus, useProgress, type ProgressState } from '../store/progress';
import { getModule, getTier, moduleLessons } from '../lib/content';
import type { Module } from '../types/content';
import '../styles/lesson.css';

type TabId = 'dersler' | 'ozet';

export default function ModulePage() {
  const { moduleId = '' } = useParams();
  const m = getModule(moduleId);
  const s = useProgress();
  if (!m) return <NotFound id={moduleId} />;
  return <ModuleView key={m.id} s={s} m={m} />;
}

function ModuleView({ s, m }: { s: ProgressState; m: Module }) {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('sekme') === 'ozet' ? 'ozet' : 'dersler';
  const setTab = (t: TabId) =>
    setParams(
      (p) => {
        if (t === 'ozet') p.set('sekme', 'ozet');
        else p.delete('sekme');
        return p;
      },
      { replace: true },
    );

  const tier = getTier(m.tier);
  const status = moduleStatus(s, m);
  const lessons = moduleLessons(m);
  const ids = (t: TabId) => tabIds('module', t);

  return (
    <div className="@container mx-auto w-full max-w-[1240px] px-6 pb-14 pt-6 lg:px-8" style={tierVars(tier?.color ?? m.color)}>
      <Link
        to="/harita"
        className="mb-4 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-[13px] font-semibold text-muted transition-colors hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Yolculuk Haritası
      </Link>

      <ModuleHero s={s} m={m} tier={tier} status={status} />

      <div className="mt-8 grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs<TabId>
            idBase="module"
            label="Modül bölümleri"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'dersler', label: 'Dersler', icon: <BookOpen className="size-4" aria-hidden />, count: lessons.length },
              { id: 'ozet', label: 'Özet Kartı', icon: <ScrollText className="size-4" aria-hidden /> },
            ]}
          />
          <div
            id={ids(tab).panel}
            role="tabpanel"
            aria-labelledby={ids(tab).tab}
            tabIndex={-1}
            className="pt-5 outline-none"
          >
            {tab === 'dersler' ? <LessonTimeline s={s} lessons={lessons} /> : <SummaryCard m={m} />}
          </div>
        </div>

        <aside className="flex flex-col gap-4 @5xl:sticky @5xl:top-6 @5xl:self-start" aria-label="Sınav ve pekiştirme">
          <BossCard s={s} m={m} status={status} />
          <PracticeCard s={s} m={m} locked={status === 'locked'} />
        </aside>
      </div>

      <div className="mt-10">
        <ModuleNav s={s} m={m} />
      </div>
    </div>
  );
}

function SummaryCard({ m }: { m: Module }) {
  if (!m.summaryHtml.trim()) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
        <Ferris size={88} mood="thinking" />
        <h3 className="mt-3 text-[15px] font-semibold text-fg">Özet kartı henüz hazır değil</h3>
        <p className="mt-1 max-w-[46ch] text-sm leading-6 text-muted">
          Bu modülün tek sayfalık özeti eklendiğinde burada olacak. O zamana kadar ders notların ve tekrar kartların sana
          özet görevi görür.
        </p>
      </div>
    );
  }
  return (
    <article
      aria-label={`${m.title} özet kartı`}
      className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card lg:p-8"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--tier)' }} />
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <span className="text-[26px]" aria-hidden>
          {m.icon}
        </span>
        <div>
          <p className="text-xs font-medium text-muted">Modül {m.number} özeti</p>
          <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{m.title}</h3>
        </div>
      </div>
      <div className="lesson-prose" dangerouslySetInnerHTML={{ __html: m.summaryHtml }} />
    </article>
  );
}

function NotFound({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <Ferris size={132} mood="sad" />
      <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.025em] text-fg">Bu modülü bulamadık</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        {id ? (
          <>
            <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-fg">{id}</code> adında bir
            modül yok. Bağlantı eski olabilir ya da modül yeniden adlandırılmış olabilir.
          </>
        ) : (
          'Bağlantıda bir modül adı yok.'
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button icon={<MapIcon className="size-4" />} onClick={() => navigate('/harita')}>
          Yolculuk haritasına dön
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Ana sayfa
        </Button>
      </div>
    </div>
  );
}
