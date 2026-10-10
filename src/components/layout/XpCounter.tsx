import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnimate } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useProgress } from '../../store/progress';
import { levelInfo } from '../../lib/xp';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Tooltip } from '../ui/Tooltip';
import { useReducedMotionPref } from '../ui/motion';
import { fmtNum } from '../shell/turkish';
import { topButton } from './StreakButton';

export default function XpCounter() {
  const xp = useProgress((s) => s.xp);
  const navigate = useNavigate();
  const info = levelInfo(xp);
  const [scope, animate] = useAnimate();
  const prev = useRef(xp);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    if (xp > prev.current && !reduced && scope.current) {
      void animate(scope.current, { scale: [1, 1.18, 1] }, { duration: 0.45, ease: 'easeOut' });
    }
    prev.current = xp;
  }, [xp, reduced, animate, scope]);

  return (
    <Tooltip
      side="bottom"
      content={
        <span>
          Seviye {info.level}: {info.title}
          <br />
          <span className="text-muted">Sonraki seviyeye {fmtNum(info.needed - info.current)} XP</span>
        </span>
      }
    >
      <button type="button" onClick={() => navigate('/profil')} className={topButton} aria-label={`Toplam ${fmtNum(xp)} XP, seviye ${info.level}`}>
        <span ref={scope} className="grid size-6 place-items-center rounded-full bg-gold-soft text-xp">
          <Zap className="size-3.5 fill-current" aria-hidden />
        </span>
        <AnimatedNumber value={xp} className="tabular-nums" />
        <span className="text-muted">XP</span>
      </button>
    </Tooltip>
  );
}
