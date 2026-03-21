import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-xl border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm transition-all duration-200',
              'placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50',
              error ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--border-color)] focus:border-[var(--accent-primary)]',
              icon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
