// Sözlük: Turkish/English Rust glossary and the compiler error guide ("Hata Rehberi").
// Deep links: /sozluk?sekme=hatalar, /sozluk?hata=E0382
import { useSearchParams } from 'react-router-dom';
import { BookA, Bug } from 'lucide-react';
import { Tabs, tabIds } from '../components/ui/Tabs';
import GlossaryList from '../components/shell/glossary/GlossaryList';
import ErrorGuide, { errorCount, findError } from '../components/shell/glossary/ErrorGuide';
import { content } from '../lib/content';

type TabId = 'sozluk' | 'hatalar';

export default function GlossaryPage() {
  const [params, setParams] = useSearchParams();
  const hata = params.get('hata');
  const glossaryEmpty = content.reference.glossary.length === 0;
  const tab: TabId =
    params.get('sekme') === 'hatalar' || findError(hata) ? 'hatalar' : params.get('sekme') === 'sozluk' ? 'sozluk' : glossaryEmpty ? 'hatalar' : 'sozluk';

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true },
    );

  const setTab = (t: TabId) => update({ sekme: t, hata: t === 'sozluk' ? null : hata });
  const ids = tabIds('glossary', tab);

  return (
    <div className="@container mx-auto w-full max-w-[1240px] px-6 pb-14 pt-7 lg:px-8">
      <header className="mb-5">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-fg">Sözlük ve Hata Rehberi</h1>
        <p className="mt-1.5 max-w-[64ch] text-[15px] leading-6 text-muted">
          Rust terimlerinin Türkçe karşılıkları ve derleyicinin hata kodlarının ne anlama geldiği, nasıl düzeltildiği.
        </p>
      </header>

      <Tabs<TabId>
        idBase="glossary"
        label="Sözlük bölümleri"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'sozluk', label: 'Sözlük', icon: <BookA className="size-4" aria-hidden />, count: content.reference.glossary.length || undefined },
          { id: 'hatalar', label: 'Hata Rehberi', icon: <Bug className="size-4" aria-hidden />, count: errorCount },
        ]}
      />

      <div id={ids.panel} role="tabpanel" aria-labelledby={ids.tab} className="pt-5">
        {tab === 'sozluk' ? (
          <GlossaryList onShowErrors={() => setTab('hatalar')} />
        ) : (
          <ErrorGuide selected={hata} onSelect={(code) => update({ sekme: 'hatalar', hata: code })} />
        )}
      </div>
    </div>
  );
}
