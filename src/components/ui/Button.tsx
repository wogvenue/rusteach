import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_8px_22px_-10px_rgb(247_76_0/0.75)] hover:bg-accent-strong',
  secondary:
    'bg-surface-2 text-fg border border-border shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] hover:bg-elevated hover:border-border-strong',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-2',
  outline: 'bg-transparent text-fg border border-border-strong hover:bg-surface-2 hover:border-subtle',
  danger: 'bg-danger text-on-danger shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110',
  success: 'bg-success text-on-success shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, block, className, children, disabled, ...rest },
  ref,
) {
  const inactive = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileTap={inactive ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={clsx(
        'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,filter,box-shadow] duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      disabled={inactive}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className={clsx('animate-spin', size === 'lg' ? 'size-5' : 'size-4')} aria-hidden /> : icon}
      {children}
      {iconRight}
    </motion.button>
  );
});

export default Button;
