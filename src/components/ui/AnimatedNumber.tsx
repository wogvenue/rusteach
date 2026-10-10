// Counts smoothly from the previous value to the new one (framer motion value rendered as text,
// so React does not re-render per frame). Screen readers get the final value only.
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useReducedMotionPref } from './motion';

const defaultFormat = (n: number) => Math.round(n).toLocaleString('tr-TR');

export function AnimatedNumber({
  value,
  format = defaultFormat,
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduced, duration, mv]);

  return (
    <span className={className}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export default AnimatedNumber;
