// /tekrar — spaced repetition. Tabs: today's session (start screen → interleaved session → summary,
// or the "nothing due" state) and the card browser (?sekme=kartlar).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dueReviews, useProgress, type SrsEntry } from '../store/progress';
import { findBlock, findFlashcard } from '../lib/content';
import { Tabs, tabIds } from '../components/ui/Tabs';
import ReviewStart, { pickEntries, type SessionSize } from '../components/review/ReviewStart';
import ReviewSession from '../components/review/ReviewSession';
import ReviewEmpty from '../components/review/ReviewEmpty';
import CardBrowser from '../components/review/CardBrowser';
import { LearnPage, PageHeader } from '../components/review/shared/ui';
import { useClock } from '../components/review/shared/hooks';

type TabId = 'oturum' | 'kartlar';

export default function ReviewPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('sekme') === 'kartlar' ? 'kartlar' : 'oturum';
  const setTab = (t: TabId) => setParams(t === 'kartlar' ? { sekme: 'kartlar' } : {}, { replace: true });

  const now = useClock(30_000);
  const srs = useProgress((s) => s.srs);
  const reviewLog = useProgress((s) => s.reviewLog);
  const newPerDay = useProgress((s) => s.settings.newCardsPerDay);
  // Recomputed whenever an input of dueReviews changes (cards, review log, new-card limit, clock).
  const due = useMemo(() => dueReviews(useProgress.getState(), now), [srs, reviewLog, newPerDay, now]);
  const cardCount = useMemo(
    () => Object.values(srs).filter((e) => (e.kind === 'check' ? !!findBlock(e.id) : !!findFlashcard(e.id))).length,
    [srs],
  );

  const [session, setSession] = useState<{ id: number; entries: SrsEntry[] } | null>(null);
  const start = (size: SessionSize) => setSession({ id: Date.now(), entries: pickEntries(due, size) });
  const startMore = () => {
    const next = dueReviews(useProgress.getState());
    setSession(next.length ? { id: Date.now(), entries: next } : null);
  };

  if (session) {
    return (
      <LearnPage className="pt-5">
        <ReviewSession key={session.id} entries={session.entries} onClose={() => setSession(null)} onMore={startMore} />
      </LearnPage>
    );
  }

  const ids = (id: TabId) => tabIds('review', id);
  return (
    <LearnPage>
      <PageHeader
        title="Tekrar"
        subtitle="Her kart, unutmaya başlayacağın sırada karşına çıkar. Kısa ve düzenli tekrar, bilgiyi kalıcı yapar."
      />
      <Tabs<TabId>
        idBase="review"
        label="Tekrar bölümleri"
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { id: 'oturum', label: 'Bugünkü tekrar', count: due.length },
          { id: 'kartlar', label: 'Kart tarayıcı', count: cardCount },
        ]}
      />
      <div role="tabpanel" id={ids(tab).panel} aria-labelledby={ids(tab).tab} tabIndex={-1} className="outline-none">
        {tab === 'kartlar' ? (
          <CardBrowser now={now} />
        ) : due.length ? (
          <ReviewStart key={due.length} due={due} onStart={start} />
        ) : (
          <ReviewEmpty now={now} onBrowse={() => setTab('kartlar')} />
        )}
      </div>
    </LearnPage>
  );
}
