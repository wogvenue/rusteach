// Module page: the "Modül Sınavı" card — threshold, best score, attempts, lock state and the
// skip-test entry for experienced learners.
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronsRight, Crown, Hourglass, Lock, RotateCcw, Swords, Target } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge, ProgressBar } from '../../ui/primitives';
import { fmtNum, fmtPct } from '../turkish';
import { BOSS_PASS_THRESHOLD, canTakeSkipTest, lessonStatus, type ModuleStatus, type ProgressData } from '../../../store/progress';
import { getLesson } from '../../../lib/content';
import type { Module } from '../../../types/content';
import { lessonsDone } from './moduleInfo';

export default function BossCard({ s, m, status }: { s: ProgressData; m: Module; status: ModuleStatus }) {
  const navigate = useNavigate();
  const boss = m.bossId ? getLesson(m.bossId) : undefined;
  const mp = s.modules[m.id];
  const passed = !!mp?.bossPassed;
  const attempts = mp?.bossAttempts ?? 0;
  const best = mp?.bossBest ?? 0;
  const done = lessonsDone(s, m);
  const total = m.lessonIds.length;

  if (!boss) {
    return (
      <section aria-labelledby="boss-title" className="rounded-2xl border border-dashed border-border-strong bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-subtle" aria-hidden>
            <Swords className="size-5" />
          </span>
          <h2 id="boss-title" className="text-[15px] font-semibold text-fg">
            Modül Sınavı
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          Bu modülün sınavı henüz eklenmedi. O zamana kadar antrenman ve tekrarlarla öğrendiklerini pekiştirebilirsin.
        </p>
      </section>
    );
  }

  const bossStatus = lessonStatus(s, boss.id);
  const moduleLocked = status === 'locked';
  const skip = moduleLocked && canTakeSkipTest(s, m);
  const open = !moduleLocked && (bossStatus === 'available' || bossStatus === 'in_progress' || bossStatus === 'completed' || passed);
  const items = boss.stats.checks + boss.stats.exercises;

  return (
    <section
      aria-labelledby="boss-title"
      className={clsx(
        'relative isolate overflow-hidden rounded-2xl border p-5 shadow-card',
        passed
          ? 'border-[color-mix(in_oklab,var(--c-gold)_38%,var(--c-border))] bg-[color-mix(in_oklab,var(--c-gold)_7%,var(--c-surface))]'
          : open
            ? 'border-[color-mix(in_oklab,var(--tier)_35%,var(--c-border))] bg-surface'
            : 'border-border bg-surface',
      )}
    >
      {open && !passed && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 -z-10 size-48 rounded-full opacity-60 blur-3xl"
          style={{ background: 'color-mix(in oklab, var(--tier) 30%, transparent)' }}
        />
      )}
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid size-11 shrink-0 place-items-center rounded-xl',
            passed ? 'bg-gold text-[#2a1a00]' : open ? 'text-[#1a0b02]' : 'bg-surface-2 text-subtle',
          )}
          style={open && !passed ? { background: 'var(--tier)' } : undefined}
          aria-hidden
        >
          {passed ? <Crown className="size-5" strokeWidth={2.4} /> : open ? <Swords className="size-5" /> : <Lock className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="boss-title" className="text-[15px] font-semibold leading-6 text-fg">
            Modül Sınavı
          </h2>
          <p className="text-[13px] leading-5 text-muted">
            {items > 0 ? `${fmtNum(items)} soru` : 'Karışık sorular'}
            {boss.minutes > 0 ? `, yaklaşık ${fmtNum(boss.minutes)} dk` : ''}
          </p>
        </div>
        {passed && <Badge tone="gold">Geçildi</Badge>}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        {passed
          ? 'Bu modülde ustalaştın. Sınavı istediğin zaman yeniden çözerek bilgini tazeleyebilirsin.'
          : `Önceki modüllerden de sorular içerir. ${fmtPct(BOSS_PASS_THRESHOLD)} ve üzeri puan modülde ustalaştığını gösterir ve sıradaki modülün kilidini açar.`}
      </p>

      <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <Target className="size-3.5" aria-hidden />
            En iyi puan
          </span>
          <span className={clsx('font-semibold tabular-nums', passed ? 'text-gold' : 'text-fg')}>
            {attempts ? fmtPct(best) : 'Henüz girilmedi'}
          </span>
        </div>
        <div className="relative mt-2.5">
          <ProgressBar value={best} height={8} color={passed ? 'var(--c-gold)' : 'var(--tier)'} label="En iyi sınav puanı" />
          <span
            aria-hidden
            className="absolute -top-1 h-4 w-[2px] rounded-full bg-fg/70"
            style={{ left: `${BOSS_PASS_THRESHOLD * 100}%` }}
            title={`Geçme sınırı ${fmtPct(BOSS_PASS_THRESHOLD)}`}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-subtle">
          <span>{attempts ? `${fmtNum(attempts)} deneme` : 'Deneme yok'}</span>
          <span>Geçme sınırı {fmtPct(BOSS_PASS_THRESHOLD)}</span>
        </div>
      </div>

      <div className="mt-4">
        {open ? (
          <Button
            block
            variant={passed ? 'secondary' : 'primary'}
            icon={passed || attempts ? <RotateCcw className="size-4" /> : <Swords className="size-4" />}
            onClick={() => navigate(`/ders/${boss.id}`)}
          >
            {passed ? 'Yeniden çöz' : attempts ? 'Tekrar dene' : 'Sınava gir'}
          </Button>
        ) : skip ? (
          <div className="space-y-2.5">
            <Button block icon={<ChevronsRight className="size-4" />} onClick={() => navigate(`/ders/${boss.id}?atlama=1`)}>
              Atlama sınavına gir
            </Button>
            <p className="text-xs leading-5 text-subtle">
              Konuyu biliyorsan bu sınavı geçerek modülü atlayabilirsin. Geçemezsen hiçbir şey kaybetmezsin.
            </p>
          </div>
        ) : moduleLocked ? (
          <p className="flex items-center gap-2 text-[13px] font-medium text-subtle">
            <Lock className="size-3.5" aria-hidden />
            Önce bu modülün kilidini aç.
          </p>
        ) : (
          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-muted">
                <Hourglass className="size-3.5" aria-hidden />
                Tüm dersleri bitirince açılır
              </span>
              <span className="font-semibold tabular-nums text-fg">
                {done}/{total}
              </span>
            </div>
            <ProgressBar className="mt-2" value={total ? done / total : 0} height={6} color="var(--tier)" label="Bitirilen dersler" />
          </div>
        )}
      </div>
    </section>
  );
}
