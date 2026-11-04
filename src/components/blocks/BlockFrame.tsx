// Card shell shared by interactive blocks: icon + label header, optional right slot, state border.
import { forwardRef, type ReactNode } from 'react';
import clsx from 'clsx';

export type FrameState = 'idle' | 'active' | 'correct' | 'incorrect';

interface BlockFrameProps {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  state?: FrameState;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Extra content rendered flush (no padding) under the body, e.g. a run output. */
  footer?: ReactNode;
  ariaLabel?: string;
}

const BlockFrame = forwardRef<HTMLElement, BlockFrameProps>(function BlockFrame(
  { icon, label, right, state = 'idle', children, className, bodyClassName, footer, ariaLabel },
  ref,
) {
  return (
    <section
      ref={ref}
      className={clsx('block-card', className)}
      data-state={state}
      aria-label={ariaLabel ?? label}
    >
      <header className="flex items-center gap-2.5 px-4 pb-1 pt-4 sm:px-5">
        <span className="block-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="text-[0.8rem] font-semibold text-muted">{label}</span>
        <span className="flex-1" />
        {right}
      </header>
      <div className={clsx('px-4 pb-4 pt-2 sm:px-5 sm:pb-5', bodyClassName)}>{children}</div>
      {footer}
    </section>
  );
});

export default BlockFrame;
