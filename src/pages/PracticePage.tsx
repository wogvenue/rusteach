// /antrenman — practice beyond the lessons. Tabs (?sekme=): karma antrenman (default), hata defteri,
// alıştırma kataloğu, hız turu. ?modul=<id> preselects a module in the mixed practice and the catalog.
// While a run is in progress the page header and tabs step aside (focus mode).
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Code2, NotebookPen, Shuffle, Timer } from 'lucide-react';
import { useProgress } from '../store/progress';
import { openMistakeCount } from '../lib/practice';
import { Tabs, tabIds } from '../components/ui/Tabs';
import MixedPractice from '../components/review/practice/MixedPractice';
import MistakeNotebook from '../components/review/practice/MistakeNotebook';
import ExerciseCatalog from '../components/review/practice/ExerciseCatalog';
import SpeedRound from '../components/review/practice/SpeedRound';
import { LearnPage, PageHeader } from '../components/review/shared/ui';

type TabId = 'karma' | 'hata' | 'katalog' | 'hiz';
const TABS: TabId[] = ['karma', 'hata', 'katalog', 'hiz'];

export default function PracticePage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('sekme') as TabId | null;
  const tab: TabId = raw && TABS.includes(raw) ? raw : 'karma';
  const moduleParam = params.get('modul') ?? undefined;
  const [focus, setFocus] = useState(false);
  const onFocusChange = useCallback((f: boolean) => setFocus(f), []);

  const setTab = useCallback(
    (t: TabId) => {
      const next: Record<string, string> = {};
      if (t !== 'karma') next.sekme = t;
      const m = params.get('modul');
      if (m) next.modul = m;
      setParams(next, { replace: true });
    },
    [params, setParams],
  );
  const openMistakes = useCallback(() => setTab('hata'), [setTab]);

  const mistakes = useProgress((s) => s.mistakes);
  // Tab badge: open mistakes.
  const openCount = useMemo(() => openMistakeCount(useProgress.getState()), [mistakes]);

  const ids = tabIds('practice', tab);
  const panel =
    tab === 'hata' ? (
      <MistakeNotebook onFocusChange={onFocusChange} />
    ) : tab === 'katalog' ? (
      <ExerciseCatalog key={moduleParam ?? 'all'} initialModule={moduleParam} />
    ) : tab === 'hiz' ? (
      <SpeedRound onFocusChange={onFocusChange} onOpenMistakes={openMistakes} />
    ) : (
      <MixedPractice initialModule={moduleParam} onFocusChange={onFocusChange} onOpenMistakes={openMistakes} />
    );

  return (
    <LearnPage className={focus ? 'pt-5' : undefined}>
      {!focus && (
        <>
          <PageHeader
            title="Antrenman"
            subtitle="Öğrendiklerini farklı yollardan yeniden çağır: karışık sorular, hatalarının üzerinden geçmek, kod yazmak ve hız."
          />
          <Tabs<TabId>
            idBase="practice"
            label="Antrenman bölümleri"
            value={tab}
            onChange={setTab}
            className="mb-6"
            tabs={[
              { id: 'karma', label: 'Karma antrenman', icon: <Shuffle className="size-4" aria-hidden /> },
              { id: 'hata', label: 'Hata defteri', icon: <NotebookPen className="size-4" aria-hidden />, count: openCount },
              { id: 'katalog', label: 'Alıştırma kataloğu', icon: <Code2 className="size-4" aria-hidden /> },
              { id: 'hiz', label: 'Hız turu', icon: <Timer className="size-4" aria-hidden /> },
            ]}
          />
        </>
      )}
      <div role={focus ? undefined : 'tabpanel'} id={ids.panel} aria-labelledby={focus ? undefined : ids.tab} className="outline-none">
        {panel}
      </div>
    </LearnPage>
  );
}
