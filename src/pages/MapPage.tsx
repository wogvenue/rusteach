// Yolculuk Haritası: eight regions from the cove to the summit, modules as coins on a winding road.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Award, ChevronsRight, Clock, Crown, Info, LocateFixed, Target, Trophy } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge, ProgressBar, ProgressRing } from '../components/ui/primitives';
import { FloatingCard } from '../components/ui/Tooltip';
import { useReducedMotionPref } from '../components/ui/motion';
import RegionBanner from '../components/shell/RegionBanner';
import { MapNode, type MapNodeInfo } from '../components/shell/map/MapNode';
import { BANNER_H, BANNER_TOP, computeLayout, NODE, segmentPath, type MapLayout, type NodeLayout } from '../components/shell/map/layout';
import { currentModule, journeyComplete, masteredModules, STATUS_LABEL } from '../components/shell/stats';
import { fmtPct, stripHtml } from '../components/shell/turkish';
import {
  BOSS_PASS_THRESHOLD, canTakeSkipTest, moduleAccuracy, moduleProgress, moduleStatus, useProgress, type ModuleStatus,
  type ProgressState,
} from '../store/progress';
import { moduleLessons, modules, tiers } from '../lib/content';

export default function MapPage() {
  const s = useProgress();
  const reduced = useReducedMotionPref();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => (width > 0 ? computeLayout(width) : null), [width]);

  const infos = useMemo(() => {
    const out: Record<string, MapNodeInfo> = {};
    for (const m of modules) {
      const lessons = m.lessonIds.length;
      out[m.id] = {
        status: moduleStatus(s, m),
        progress: moduleProgress(s, m),
        lessonsDone: m.lessonIds.filter((id) => s.lessons[id]?.status === 'completed').length,
        lessonsTotal: lessons,
        skipTest: canTakeSkipTest(s, m),
      };
    }
    return out;
  }, [s]);

  const current = currentModule(s);
  const done = journeyComplete(s);
  const mastered = masteredModules(s).length;

  // --- auto-scroll to the learner's position, and the floating "Konumuma git" button
  const currentRef = useRef<HTMLAnchorElement>(null);
  const goToCurrent = useCallback(
    (smooth = true) => {
      const el = currentRef.current ?? document.getElementById('map-terminus');
      el?.scrollIntoView({ block: 'center', behavior: smooth && !reduced ? 'smooth' : 'auto' });
    },
    [reduced],
  );
  const ready = !!layout;
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => goToCurrent(true), 260);
    return () => window.clearTimeout(t);
  }, [ready, goToCurrent]);

  const [offscreen, setOffscreen] = useState<null | 'up' | 'down'>(null);
  useEffect(() => {
    const el = currentRef.current;
    const root = document.getElementById('main');
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setOffscreen(null);
        else setOffscreen(e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'up' : 'down');
      },
      { root, threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, current?.id]);

  // --- hover card
  const [hover, setHover] = useState<{ node: NodeLayout; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const onHover = useCallback((node: NodeLayout | null) => {
    window.clearTimeout(hoverTimer.current);
    if (!node) {
      setHover(null);
      return;
    }
    // a short delay keeps cards from flashing while the pointer travels across the map
    hoverTimer.current = window.setTimeout(() => {
      const el = document.getElementById(`node-${node.module.id}`)?.parentElement;
      if (el) setHover({ node, rect: el.getBoundingClientRect() });
    }, 110);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    const root = document.getElementById('main');
    const clear = () => setHover(null);
    root?.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear);
    return () => {
      root?.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
    };
  }, []);

  return (
    <div className="pb-20">
      <header className="mx-auto w-full max-w-[1100px] px-6 pt-7 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-[620px]">
            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-fg">Yolculuk Haritası</h1>
            <p className="mt-2 text-[15px] leading-6 text-muted">
              Başlangıç Koyu’ndan Uzman Zirvesi’ne {tiers.length} bölge, {modules.length} modül. Her modül bir sınavla biter:
              {' '}
              {fmtPct(BOSS_PASS_THRESHOLD)} ile geçtiğinde ustalaşırsın ve yol bir sonraki modüle açılır.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <ProgressRing value={modules.length ? mastered / modules.length : 0} size={52} stroke={5} color="var(--c-gold)" label="Ustalaşılan modüller">
                <Crown className="size-4 text-gold" aria-hidden />
              </ProgressRing>
              <div>
                <div className="text-lg font-semibold leading-tight tabular-nums text-fg">
                  {mastered}/{modules.length}
                </div>
                <div className="text-[13px] text-muted">modül ustalaşıldı</div>
              </div>
            </div>
            <Button variant="secondary" icon={<LocateFixed className="size-4" />} onClick={() => goToCurrent(true)}>
              Konumuma git
            </Button>
          </div>
        </div>
        {s.settings.freeMode && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft px-3.5 py-2.5 text-[13px] leading-5 text-fg">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            Serbest mod açık: bütün modüllere girebilirsin. Ustalık yine modül sınavlarıyla kazanılır.
          </p>
        )}
      </header>

      <div className="relative mt-6" data-map>
        {/* full-bleed region tints */}
        {layout?.bands.map((b) => {
          const locked = b.nodes.length > 0 && b.nodes.every((n) => infos[n.module.id]?.status === 'locked');
          return (
            <div
              key={b.tier.id}
              aria-hidden
              className="pointer-events-none absolute inset-x-0"
              style={{
                top: b.top,
                height: b.bottom - b.top,
                background: locked
                  ? undefined
                  : `linear-gradient(180deg, transparent 0%, color-mix(in oklab, ${b.tier.color} 6%, transparent) 22%, color-mix(in oklab, ${b.tier.color} 6%, transparent) 80%, transparent 100%)`,
              }}
            />
          );
        })}

        <div className="mx-auto w-full max-w-[920px] px-6">
          <div ref={canvasRef} className="relative" style={{ height: layout?.height ?? 1200 }}>
            {layout && (
              <>
                <Road layout={layout} infos={infos} done={done} reduced={reduced} />
                {layout.bands.map((b) => (
                  <Band
                    key={b.tier.id}
                    band={b}
                    layout={layout}
                    infos={infos}
                    currentId={current?.id}
                    currentRef={currentRef}
                    reduced={reduced}
                    onHover={onHover}
                  />
                ))}
                <Terminus layout={layout} done={done} mastered={mastered} />
              </>
            )}
          </div>
        </div>
      </div>

      <FloatingCard anchor={hover?.rect ?? null} side={hover?.node.labelSide === 'left' ? 'right' : 'left'}>
        {hover && <ModuleCard node={hover.node} info={infos[hover.node.module.id]} s={s} />}
      </FloatingCard>

      <AnimatePresence>
        {offscreen && (
          <motion.div
            className="fixed bottom-6 right-8 z-30"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <Button
              icon={offscreen === 'up' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              onClick={() => goToCurrent(true)}
              className="shadow-pop"
            >
              Konumuma git
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ road

function Road({ layout, infos, done, reduced }: { layout: MapLayout; infos: Record<string, MapNodeInfo>; done: boolean; reduced: boolean }) {
  const segs = useMemo(() => {
    const out: { d: string; traveled: boolean; from: NodeLayout; toColor: string; key: string; a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    const ns = layout.nodes;
    ns.forEach((n, i) => {
      const next = ns[i + 1];
      const b = next ?? layout.terminus;
      const traveled = infos[n.module.id]?.status === 'mastered';
      out.push({
        d: segmentPath(n, b),
        traveled: next ? traveled : traveled && done,
        from: n,
        toColor: next ? next.tier.color : '#f5c542',
        key: `${n.module.id}-${next?.module.id ?? 'end'}`,
        a: n,
        b,
      });
    });
    return out;
  }, [layout, infos, done]);

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden>
      <defs>
        {segs.map((sg) =>
          sg.from.tier.color !== sg.toColor ? (
            <linearGradient key={sg.key} id={`road-${sg.key}`} gradientUnits="userSpaceOnUse" x1={sg.a.x} y1={sg.a.y} x2={sg.b.x} y2={sg.b.y}>
              <stop offset="0.15" stopColor={sg.from.tier.color} />
              <stop offset="0.85" stopColor={sg.toColor} />
            </linearGradient>
          ) : null,
        )}
      </defs>
      {/* the whole road, dotted */}
      {segs.map((sg) => (
        <path
          key={`base-${sg.key}`}
          d={sg.d}
          fill="none"
          stroke="var(--c-border-strong)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="0.1 15"
        />
      ))}
      {/* walked parts */}
      {segs
        .filter((sg) => sg.traveled)
        .map((sg, i) => {
          const stroke = sg.from.tier.color !== sg.toColor ? `url(#road-${sg.key})` : sg.from.tier.color;
          return (
            <g key={`walk-${sg.key}`}>
              <path d={sg.d} fill="none" stroke={stroke} strokeWidth="20" strokeLinecap="round" opacity="0.14" />
              <motion.path
                d={sg.d}
                fill="none"
                stroke={stroke}
                strokeWidth="7"
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : Math.min(1.2, 0.08 + i * 0.07), ease: 'easeOut' }}
              />
            </g>
          );
        })}
    </svg>
  );
}

// ------------------------------------------------------------------ band

function Band({
  band,
  layout,
  infos,
  currentId,
  currentRef,
  reduced,
  onHover,
}: {
  band: MapLayout['bands'][number];
  layout: MapLayout;
  infos: Record<string, MapNodeInfo>;
  currentId?: string;
  currentRef: RefObject<HTMLAnchorElement | null>;
  reduced: boolean;
  onHover: (n: NodeLayout | null) => void;
}) {
  const statuses: ModuleStatus[] = band.nodes.map((n) => infos[n.module.id]?.status ?? 'locked');
  const locked = statuses.length > 0 && statuses.every((x) => x === 'locked');
  return (
    <>
      <div className="absolute inset-x-0" style={{ top: band.top + BANNER_TOP, height: BANNER_H }}>
        <RegionBanner
          tier={band.tier}
          index={band.index}
          statuses={statuses}
          locked={locked || statuses.length === 0}
          id={`region-${band.tier.id}`}
          className="h-full shadow-card [&_p]:line-clamp-2"
        />
      </div>
      {band.nodes.map((n) => (
        <MapNode
          key={n.module.id}
          ref={n.module.id === currentId ? currentRef : undefined}
          node={n}
          info={infos[n.module.id]}
          current={n.module.id === currentId}
          reduced={reduced}
          onHover={onHover}
        />
      ))}
      {band.emptyY !== undefined && (
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-dashed border-border-strong bg-surface px-4 py-2 text-[13px] font-medium text-muted shadow-card"
          style={{ left: layout.center, top: band.emptyY }}
        >
          <Clock className="size-4 text-subtle" aria-hidden />
          Bu bölgenin modülleri hazırlanıyor
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ terminus

function Terminus({ layout, done, mastered }: { layout: MapLayout; done: boolean; mastered: number }) {
  const { x, y } = layout.terminus;
  const size = NODE + 12;
  return (
    <div className="absolute flex w-[300px] -translate-x-1/2 flex-col items-center text-center" style={{ left: x, top: y - size / 2 }}>
      <Link
        id="map-terminus"
        to="/profil#sertifika"
        aria-label={done ? 'Rust Yolculuğu Sertifikan hazır. Görüntüle.' : 'Rust Yolculuğu Sertifikası. Tüm modülleri ustalaşınca açılır.'}
        className={clsx(
          'relative grid place-items-center rounded-full [--depth:6px] transition-[transform,box-shadow] duration-150',
          'shadow-[0_var(--depth)_0_var(--edge)] hover:-translate-y-0.5 active:translate-y-1 active:[--depth:2px]',
        )}
        style={{
          width: size,
          height: size,
          ['--edge' as string]: done ? '#8a5a00' : 'var(--c-border-strong)',
          background: done ? 'radial-gradient(120% 100% at 50% 0%, #ffe9a8, #f5c542 55%, #c98a00)' : 'var(--c-surface-2)',
          border: done ? undefined : '2px dashed var(--c-border-strong)',
        }}
      >
        {done && <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full" style={{ boxShadow: '0 0 0 4px #f5c542' }} aria-hidden />}
        <Trophy className={clsx('size-10', done ? 'text-[#5a3a00]' : 'text-subtle')} aria-hidden />
      </Link>
      <div className="mt-4 text-[15px] font-semibold text-fg">Rust Yolculuğu Sertifikası</div>
      <div className="mt-0.5 text-[13px] text-muted">
        {done ? 'Bütün modülleri ustalaştın. Sertifikan hazır.' : `${modules.length - mastered} modül kaldı. Hepsini ustalaşınca açılır.`}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ hover card

function ModuleCard({ node, info, s }: { node: NodeLayout; info: MapNodeInfo; s: ProgressState }) {
  const m = node.module;
  const lessons = moduleLessons(m);
  const minutes = lessons.reduce((a, l) => a + (l.minutes || 0), 0);
  const acc = moduleAccuracy(s, m.id);
  const mp = s.modules[m.id];
  const tone: Record<ModuleStatus, 'neutral' | 'accent' | 'info' | 'gold' | 'success'> = {
    locked: 'neutral',
    available: 'accent',
    in_progress: 'info',
    completed: 'accent',
    mastered: 'gold',
  };
  const hint =
    info.status === 'locked'
      ? info.skipTest
        ? 'Konuyu biliyorsan atlama sınavıyla bu modülü doğrudan geçebilirsin.'
        : 'Önceki modülün sınavını geçince açılır.'
      : info.status === 'completed'
        ? `Dersler bitti. Modül sınavından ${fmtPct(BOSS_PASS_THRESHOLD)} al, ustalaş.`
        : info.status === 'mastered'
          ? 'Ustalaştın. Tekrarlar bu modülü taze tutar.'
          : 'Modül sayfasını açmak için tıkla.';

  return (
    <div className="w-[300px] rounded-2xl border border-border bg-elevated p-4 text-left shadow-pop" style={{ ['--tier' as string]: node.tier.color }}>
      <div className="flex items-center justify-between gap-2">
        <span className="tier-ink text-xs font-semibold">
          Modül {m.number}, {node.tier.title}
        </span>
        <Badge tone={tone[info.status]}>{STATUS_LABEL[info.status]}</Badge>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: 'color-mix(in oklab, var(--tier) 16%, transparent)' }} aria-hidden>
          {m.icon}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-snug text-fg">{m.title}</div>
          <div className="mt-0.5 text-[13px] leading-5 text-muted">{m.subtitle}</div>
        </div>
      </div>
      {m.description && <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-muted">{stripHtml(m.description)}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Award className="size-3.5 text-subtle" aria-hidden />
          {lessons.length} ders
        </span>
        {minutes > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-subtle" aria-hidden />
            yaklaşık {minutes} dk
          </span>
        )}
        {acc !== null && (
          <span className="inline-flex items-center gap-1">
            <Target className="size-3.5 text-subtle" aria-hidden />
            ilk denemede {fmtPct(acc)}
          </span>
        )}
        {mp && mp.bossAttempts > 0 && (
          <span className="inline-flex items-center gap-1">
            <Trophy className="size-3.5 text-subtle" aria-hidden />
            sınav en iyi {fmtPct(mp.bossBest)}
          </span>
        )}
      </div>
      {info.status !== 'locked' && info.status !== 'mastered' && (
        <div className="mt-3">
          <ProgressBar value={info.progress} color="var(--tier)" height={6} label="Modül ilerlemesi" />
        </div>
      )}
      <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-xs leading-5 text-subtle">
        {info.skipTest && info.status === 'locked' && <ChevronsRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
        {hint}
      </p>
    </div>
  );
}
