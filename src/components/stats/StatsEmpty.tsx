// Welcome state for a learner with no data yet: what this page will show and a first step.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, BrainCircuit, CalendarDays, Gauge, Map as MapIcon, Target } from 'lucide-react';
import { nextLessonId, useProgress } from '../../store/progress';
import { getLesson } from '../../lib/content';
import Ferris from '../Ferris';
import { Button } from '../ui/Button';

const LEVELS = ['var(--lx-heat-0)', 'var(--lx-heat-1)', 'var(--lx-heat-2)', 'var(--lx-heat-3)', 'var(--lx-heat-4)'];
// A fixed, gently rising pattern for the preview calendar (7 weeks × 7 days).
const PATTERN = [0, 1, 0, 0, 2, 0, 0, 1, 0, 2, 1, 0, 0, 0, 2, 1, 0, 2, 3, 0, 1, 1, 2, 0, 3, 2, 0, 0, 2, 3, 1, 3, 2, 1, 0, 3, 2, 4, 3, 2, 1, 2, 3, 4, 3, 4, 2, 3, 4];

const FEATURES = [
  { icon: CalendarDays, title: 'Çalışma takvimin', text: 'Her gün ne kadar çalıştığın ve serin, tek bakışta.' },
  { icon: Target, title: 'Modül doğruluğun', text: 'Hangi konuyu sağlam bildiğin, hangisine dönmen gerektiği.' },
  { icon: BrainCircuit, title: 'Hafıza gücün', text: 'Kartlarını ne kadar iyi hatırladığın ve tekrar takvimin.' },
  { icon: Gauge, title: 'Güven ayarın', text: '“Eminim” dediğinde gerçekten ne kadar haklı olduğun.' },
];

function PreviewCalendar() {
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" aria-hidden>
      {PATTERN.map((lvl, i) => (
        <motion.span
          key={i}
          className="size-3.5 rounded-[4px]"
          style={{ background: LEVELS[lvl] }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 + i * 0.012, type: 'spring', stiffness: 300, damping: 22 }}
        />
      ))}
    </div>
  );
}

export default function StatsEmpty() {
  const navigate = useNavigate();
  const state = useProgress();
  const next = useMemo(() => getLesson(nextLessonId(state) ?? ''), [state]);

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface"
        aria-labelledby="stats-empty-title"
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
        <div className="lx-hairline-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="relative grid items-center gap-8 px-8 py-10 @4xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col items-center gap-6 text-center @2xl:flex-row @2xl:items-center @2xl:text-left">
            <Ferris mood="wave" size={128} />
            <div className="max-w-lg">
              <h2 id="stats-empty-title" className="text-2xl font-semibold tracking-tight text-fg">
                İstatistiklerin ilk dersinle başlıyor
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ders bitirdikçe, soru cevapladıkça ve tekrar yaptıkça burası senin öğrenme haritana dönüşür: güçlü yanlarını, unutmaya
                başladığın konuları ve en verimli saatlerini burada göreceksin.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 @2xl:justify-start">
                {next && (
                  <Button size="lg" icon={<BookOpen className="size-4" aria-hidden />} onClick={() => navigate(`/ders/${next.id}`)}>
                    Derse başla
                  </Button>
                )}
                <Button size="lg" variant="secondary" icon={<MapIcon className="size-4" aria-hidden />} onClick={() => navigate('/harita')}>
                  Yolculuk haritası
                </Button>
              </div>
              {next && (
                <p className="mt-3 text-xs text-subtle">
                  Sıradaki ders: <span className="font-medium text-muted">{next.title}</span>
                </p>
              )}
            </div>
          </div>
          <div className="hidden justify-self-center rounded-2xl border border-border bg-surface-2/70 p-4 @4xl:block">
            <PreviewCalendar />
            <div className="mt-3 text-center text-[11px] text-subtle">Örnek bir çalışma takvimi</div>
          </div>
        </div>
      </motion.section>

      <ul className="grid gap-3 @3xl:grid-cols-2 @5xl:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.li
            key={f.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, type: 'spring', stiffness: 260, damping: 26 }}
            className="rounded-3xl border border-border bg-surface p-4"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <f.icon className="size-[18px]" aria-hidden />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-fg">{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
