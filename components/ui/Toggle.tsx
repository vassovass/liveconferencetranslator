/**
 * Toggle Component (shadcn-inspired)
 *
 * Mobile-first toggle/switch with touch-friendly target.
 * Minimum touch target: 44px
 */

import React, { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, description, size = 'md', id, checked, ...props }, ref) => {
    const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

    const sizes = {
      sm: { track: 'w-8 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3.5' },
      md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
      lg: { track: 'w-14 h-8', thumb: 'w-6 h-6', translate: 'translate-x-6' },
    };

    const sizeConfig = sizes[size];

    return (
      <label
        htmlFor={toggleId}
        className={cn(
          'flex items-center gap-3 cursor-pointer min-h-[44px]',
          props.disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={toggleId}
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          {/* Track */}
          <div
            className={cn(
              'rounded-full transition-colors duration-200',
              sizeConfig.track,
              'bg-zinc-700',
              'peer-checked:bg-yellow-400',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-400/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950'
            )}
          />
          {/* Thumb */}
          <div
            className={cn(
              'absolute top-0.5 left-0.5 rounded-full transition-transform duration-200',
              sizeConfig.thumb,
              'bg-white shadow-sm',
              checked && sizeConfig.translate
            )}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-white">{label}</span>
            )}
            {description && (
              <span className="text-xs text-zinc-400">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';

export { Toggle };
