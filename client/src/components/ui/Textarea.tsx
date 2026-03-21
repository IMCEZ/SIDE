import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, resize = 'vertical', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-[var(--bg-secondary)] px-4 py-3 text-sm transition-all duration-200',
            'placeholder:text-[var(--text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50',
            error ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--border-color)] focus:border-[var(--accent-primary)]',
            resize === 'none' && 'resize-none',
            resize === 'vertical' && 'resize-y',
            resize === 'horizontal' && 'resize-x',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
