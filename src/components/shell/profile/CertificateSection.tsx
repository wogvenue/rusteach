// "Rust Yolculuğu Sertifikası" on the profile: printable when every module is mastered, otherwise
// a veiled preview with the remaining path.
import { Lock, Map as MapIcon, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/primitives';
import Certificate, { certificateSerial, type CertificateData } from '../Certificate';
import { modules } from '../../../lib/content';
import type { ProgressData } from '../../../store/progress';
import { completedLessonCount, journeyComplete, masteredModules, solvedExerciseCount } from '../stats';
import { fmtNum } from '../turkish';

function certificateData(s: ProgressData): CertificateData {
  const dates = modules.map((m) => s.modules[m.id]?.masteredAt).filter((d): d is string => !!d).sort();
  return {
    name: s.profile.name,
    date: dates.at(-1) ?? new Date().toISOString(),
    modules: modules.length,
    lessons: completedLessonCount(s),
    exercises: solvedExerciseCount(s),
    hours: Math.max(1, Math.round(s.totalSeconds / 3600)),
    serial: certificateSerial(s.profile.createdAt, s.profile.name),
  };
}

export default function CertificateSection({ s }: { s: ProgressData }) {
  const navigate = useNavigate();
  const done = journeyComplete(s);
  const mastered = masteredModules(s).length;
  const total = modules.length;
  const data = certificateData(s);

  return (
    <section id="sertifika" aria-labelledby="cert-title" className="scroll-mt-6 rounded-3xl border border-border bg-surface p-5 shadow-card lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cert-title" className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
            Rust Yolculuğu Sertifikası
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {done
              ? 'Bütün modüllerde ustalaştın. Sertifikanı yazdırabilir ya da PDF olarak kaydedebilirsin.'
              : 'Bütün modül sınavlarını geçtiğinde adına düzenlenir.'}
          </p>
        </div>
        {done && (
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Yazdır ya da PDF kaydet
          </Button>
        )}
      </div>

      <div className="relative mx-auto mt-5 max-w-[860px] overflow-hidden rounded-2xl border border-border">
        {done ? (
          <Certificate data={data} printable className="shadow-pop" />
        ) : (
          <>
            <div aria-hidden className="pointer-events-none select-none opacity-60 blur-[5px] saturate-50">
              <Certificate data={{ ...data, date: new Date().toISOString() }} />
            </div>
            <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--c-bg)_45%,transparent)] p-4">
              <div className="w-full max-w-[380px] rounded-2xl border border-border-strong bg-surface p-5 text-center shadow-pop">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-gold-soft text-gold" aria-hidden>
                  <Lock className="size-5" />
                </span>
                <p className="mt-3 text-[15px] font-semibold text-fg">
                  {total - mastered > 0 ? `${fmtNum(total - mastered)} modül kaldı` : 'Son adımdasın'}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted">
                  Her modülün sınavından en az %80 al; sertifika kendiliğinden açılır.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={total ? mastered / total : 0} color="var(--c-gold)" height={7} label="Ustalaşılan modüller" />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
                    {mastered}/{total}
                  </span>
                </div>
                <Button className="mt-4" size="sm" variant="secondary" icon={<MapIcon className="size-4" />} onClick={() => navigate('/harita')}>
                  Haritada nerede olduğuna bak
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
