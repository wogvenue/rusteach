// "Karma antrenman": pick modules, size and whether coding exercises join; the set is weighted toward
// weak spots and interleaved across lessons (lib/practice.buildPracticeSet), then run.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Play, RotateCcw, Scale, Shuffle } from 'lucide-react';
import { nextLessonId, useProgress } from '../../../store/progress';
import { findBlock, getLesson } from '../../../lib/content';
import { blockPreview, buildPracticeSet, practiceCandidates, practiceModules, weakSpotSummary, type PracticeItem } from '../../../lib/practice';
import { formatNumber } from '../../../lib/stats';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, FilterChip, ModuleTag, SectionCard, ToggleRow } from '../shared/ui';
import { readLocal, useHotkeys, writeLocal } from '../shared/hooks';
import PracticeRunner from './PracticeRunner';

const PREFS_KEY = 'rusteach-practice-prefs';
const CHECK_SECONDS = 40;
const EXERCISE_SECONDS = 240;

interface Prefs {
  size: string;
  includeExercises: boolean;
}

function sizeOptions(total: number): string[] {
  if (total <= 10) return ['all'];
  const fixed = [10, 20, 30].filter((n) => n < total).map(String);
  return total <= 30 ? [...fixed, 'all'] : ['10', '20', '30'];
}

const WHY = [
  {
    icon: Scale,
    title: 'Zayıf noktalara ağırlık',
    text: 'Yanlış yaptığın, tahminle bildiğin ve unutmaya yaklaştığın sorular daha sık seçilir.',
  },
  {
    icon: Shuffle,
    title: 'Karışık sıra',
    text: 'Ardışık iki soru aynı dersten gelmez. Konuyu her seferinde kendin tanımak, bilgiyi daha esnek yapar.',
  },
  {
    icon: RotateCcw,
    title: 'İkinci şans',
    text: 'Yanlış cevapladığın soru, birkaç soru sonra bir kez daha gelir; doğru cevapla hata defterinden çıkar.',
  },
];

export default function MixedPractice({
  initialModule,
  onFocusChange,
  onOpenMistakes,
}: {
  initialModule?: string;
  onFocusChange: (focus: boolean) => void;
  onOpenMistakes: () => void;
}) {
  const navigate = useNavigate();
  const state = useProgress();
  // Depends only on which lessons are completed.
  const available = useMemo(() => practiceModules(state), [state.lessons]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = available.map((m) => m.module.id);
    return new Set(initialModule && ids.includes(initialModule) ? [initialModule] : ids);
  });
  const [prefs, setPrefs] = useState<Prefs>(() => readLocal<Prefs>(PREFS_KEY, { size: '10', includeExercises: false }));
  const [session, setSession] = useState<{ id: number; items: PracticeItem[] } | null>(null);

  useEffect(() => {
    onFocusChange(!!session);
  }, [session, onFocusChange]);
  useEffect(() => () => onFocusChange(false), [onFocusChange]);

  // A module given in the URL (?modul=) after mount, e.g. from an insight link.
  useEffect(() => {
    if (initialModule && available.some((m) => m.module.id === initialModule)) setSelected(new Set([initialModule]));
  }, [initialModule]);

  const moduleIds = useMemo(() => [...selected], [selected]);
  const hasExercises = available.some((m) => selected.has(m.module.id) && m.exercises > 0);
  const includeExercises = prefs.includeExercises && hasExercises;
  const candidates = useMemo(
    () => (moduleIds.length ? practiceCandidates(state, { moduleIds, includeExercises }) : []),
    [state, moduleIds, includeExercises],
  );
  const summary = useMemo(() => weakSpotSummary(candidates), [candidates]);
  const weakest = useMemo(() => [...candidates].filter((c) => c.weight >= 2).sort((a, b) => b.weight - a.weight).slice(0, 3), [candidates]);

  const options = sizeOptions(candidates.length);
  const size = options.includes(prefs.size) ? prefs.size : options.includes('all') && Number(prefs.size) >= candidates.length ? 'all' : options[0];
  const count = size === 'all' ? candidates.length : Number(size);
  const exerciseCount = includeExercises
    ? Math.min(
        candidates.filter((c) => c.kind === 'exercise').length,
        Math.max(1, Math.round(count * 0.2)),
      )
    : 0;
  const minutes = Math.max(1, Math.round(((count - exerciseCount) * CHECK_SECONDS + exerciseCount * EXERCISE_SECONDS) / 60));

  const updatePrefs = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    writeLocal(PREFS_KEY, next);
  };

  const start = () => {
    if (!candidates.length) return;
    const items = buildPracticeSet(useProgress.getState(), { size: count, seed: Date.now(), moduleIds, includeExercises });
    if (items.length) setSession({ id: Date.now(), items });
  };

  useHotkeys(session || !candidates.length ? {} : { Enter: start });

  if (session) {
    return (
      <PracticeRunner
        key={session.id}
        items={session.items}
        onClose={() => setSession(null)}
        onRestart={start}
        onOpenMistakes={() => {
          setSession(null);
          onOpenMistakes();
        }}
      />
    );
  }

  if (!available.length) {
    const next = getLesson(nextLessonId(state) ?? '');
    return (
      <EmptyState
        mood="thinking"
        title="Antrenman için önce bir ders bitir"
        actions={
          next && (
            <Button icon={<BookOpen className="size-4" />} onClick={() => navigate(`/ders/${next.id}`)}>
              Derse başla
            </Button>
          )
        }
      >
        Karma antrenman, bitirdiğin derslerin sorularından oluşur. İlk dersini tamamladığında burada seni karışık bir tur bekliyor
        olacak.
      </EmptyState>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = selected.size === available.length;

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <SectionCard title="Antrenmanını ayarla" description="Bitirdiğin derslerden karışık bir tur oluşturulur.">
        <div className="space-y-5">
          <fieldset>
            <div className="mb-2 flex items-center justify-between gap-2">
              <legend className="text-xs font-semibold text-muted">Modüller</legend>
              <button
                type="button"
                onClick={() => setSelected(new Set(allSelected ? [] : available.map((m) => m.module.id)))}
                className="rounded-md text-xs font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                {allSelected ? 'Seçimi temizle' : 'Tümünü seç'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {available.map(({ module, checks, exercises }) => (
                <FilterChip
                  key={module.id}
                  active={selected.has(module.id)}
                  onClick={() => toggle(module.id)}
                  color={module.color}
                  title={`${checks} soru, ${exercises} alıştırma`}
                >
                  <span aria-hidden>{module.icon}</span> {module.title}
                </FilterChip>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span id="mixed-size-label" className="text-xs font-semibold text-muted">
              Soru sayısı
            </span>
            <Segmented
              labelledBy="mixed-size-label"
              size="sm"
              value={size}
              onChange={(v) => updatePrefs({ size: v })}
              options={options.map((o) => ({ value: o, label: o === 'all' ? `Hepsi (${candidates.length})` : o }))}
            />
          </div>

          <ToggleRow
            checked={includeExercises}
            disabled={!hasExercises}
            onChange={(v) => updatePrefs({ includeExercises: v })}
            label="Kodlama alıştırmaları da gelsin"
            description={
              hasExercises
                ? 'Yaklaşık her beş sorudan biri kısa bir kodlama görevi olur. Tur uzar ama kalıcılık artar.'
                : 'Seçtiğin modüllerde henüz alıştırma yok.'
            }
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button size="lg" icon={<Play className="size-4" />} onClick={start} disabled={!candidates.length} className="min-w-52">
              Antrenmana başla
            </Button>
            <span className="text-sm text-muted">
              {candidates.length ? `${count} soru, yaklaşık ${minutes} dakika` : 'En az bir modül seç.'}
            </span>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-col gap-5">
        <SectionCard title="Zayıf noktaların" description="Seçtiğin modüllerde öncelik verilecek sorular.">
          <dl className="grid grid-cols-2 gap-2">
            {[
              { label: 'Açık hata', value: summary.openMistakes },
              { label: 'Unutulmaya yakın', value: summary.fading },
              { label: 'İlk denemede yanlış', value: summary.wrongFirst },
              includeExercises
                ? { label: 'Çözülmemiş alıştırma', value: summary.unsolved }
                : { label: 'Toplam soru', value: summary.total },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface-2/70 px-3.5 py-3">
                <dt className="text-xs font-medium text-muted">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-fg lx-tabular">{formatNumber(s.value)}</dd>
              </div>
            ))}
          </dl>
          {weakest.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-muted">En çok çalışman gerekenler</h3>
              <ul className="mt-2 space-y-2">
                {weakest.map((c, i) => {
                  const loc = findBlock(c.id);
                  if (!loc) return null;
                  const p = blockPreview(loc.block);
                  return (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="rounded-2xl border border-border px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <ModuleTag module={loc.module} compact />
                        <span className="truncate text-xs text-subtle">{p.label}</span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-sm text-fg">{p.text}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.reasons.slice(0, 2).map((r) => (
                          <span key={r} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                            {r}
                          </span>
                        ))}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Nasıl seçiyoruz?">
          <ul className="space-y-3.5">
            {WHY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-semibold text-fg">{title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
