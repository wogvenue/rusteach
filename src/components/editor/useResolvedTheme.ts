import { useSyncExternalStore } from 'react';

// The shell writes <html data-theme="dark|light">; this hook follows it.
function read(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}

export function useResolvedTheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}
