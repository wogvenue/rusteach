import { useSyncExternalStore } from 'react';

/** Phone-sized layout (bottom tab bar instead of the sidebar). */
const QUERY = '(max-width: 767px)';

function subscribe(cb: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
}
