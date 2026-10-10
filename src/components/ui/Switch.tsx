import { motion } from 'framer-motion';
import clsx from 'clsx';

export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name when there is no visible label to point labelledBy at. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'justify-end border-transparent bg-accent' : 'justify-start border-border-strong bg-surface-2',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 38 }}
        className={clsx('block size-[22px] rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.3)]', checked ? 'bg-accent-fg' : 'bg-muted')}
      />
    </button>
  );
}

export default Switch;
