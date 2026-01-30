/**
 * Button Component (shadcn-inspired)
 *
 * Mobile-first button with variants and sizes.
 * Minimum touch target: 44px
 */

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn, cva } from './cn';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
  {
    variants: {
      variant: {
        primary:
          'bg-yellow-400 text-black hover:bg-yellow-300 focus:ring-yellow-400 shadow-lg shadow-yellow-400/20',
        destructive:
          'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 focus:ring-red-500',
        outline:
          'border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 focus:ring-zinc-500',
        ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800 focus:ring-zinc-500',
        secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus:ring-zinc-500',
      },
      size: {
        sm: 'text-xs px-3 py-1.5 rounded min-h-[36px]',
        md: 'text-sm px-4 py-2 rounded-lg min-h-[44px]',
        lg: 'text-base px-6 py-3 rounded-full min-h-[48px]',
        icon: 'p-2 rounded-lg min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'destructive' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
