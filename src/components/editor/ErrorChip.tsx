// A clickable compiler error code (E0382) that opens the explanation popover.
import { useCallback, useState } from 'react';
import clsx from 'clsx';
import ErrorCodePopover from './ErrorCodePopover';

export default function ErrorChip({ code, className }: { code: string; className?: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button
        type="button"
        className={clsx('err-chip font-mono', className)}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        title={`${code} hatasının açıklaması`}
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((a) => (a ? null : el));
        }}
      >
        {code}
      </button>
      {anchor && <ErrorCodePopover code={code} anchor={anchor} onClose={close} />}
    </>
  );
}
