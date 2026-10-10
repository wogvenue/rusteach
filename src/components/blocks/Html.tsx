// Renders trusted, pre-rendered lesson HTML. External links open in the system browser and static
// code blocks get a copy button.
import { useEffect, useRef, type MouseEvent } from 'react';
import clsx from 'clsx';
import { copyText, openExternal } from '../editor/util';

const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export function handleExternalLinkClick(e: MouseEvent<HTMLElement>) {
  const a = (e.target as HTMLElement).closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href') ?? '';
  if (/^https?:\/\//i.test(href)) {
    e.preventDefault();
    openExternal(href);
  }
}

export default function Html({
  html,
  className,
  as: Tag = 'div',
  prose = true,
  size,
}: {
  html: string;
  className?: string;
  as?: 'div' | 'span';
  prose?: boolean;
  size?: 'sm' | 'xs';
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blocks = root.querySelectorAll<HTMLElement>('.static-code');
    const cleanups: (() => void)[] = [];
    blocks.forEach((block) => {
      if (block.querySelector(':scope > .static-copy')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'static-copy';
      btn.setAttribute('aria-label', 'Kodu kopyala');
      btn.title = 'Kopyala';
      btn.innerHTML = COPY_ICON;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onClick = async () => {
        const text = block.querySelector('pre')?.textContent ?? '';
        if (await copyText(text)) {
          btn.dataset.copied = 'true';
          btn.innerHTML = CHECK_ICON;
          clearTimeout(timer);
          timer = setTimeout(() => {
            btn.dataset.copied = 'false';
            btn.innerHTML = COPY_ICON;
          }, 1400);
        }
      };
      btn.addEventListener('click', onClick);
      block.appendChild(btn);
      cleanups.push(() => {
        clearTimeout(timer);
        btn.removeEventListener('click', onClick);
        btn.remove();
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [html]);

  return (
    <Tag
      ref={ref as never}
      className={clsx(prose && 'lesson-prose', size === 'sm' && 'prose-sm', size === 'xs' && 'prose-xs', className)}
      onClick={handleExternalLinkClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
