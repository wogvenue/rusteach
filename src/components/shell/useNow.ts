import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs` (also when the window regains focus). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}
