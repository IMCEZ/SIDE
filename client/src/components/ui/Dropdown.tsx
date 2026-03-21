import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = '请选择...',
  label,
  error,
  disabled,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50',
          error ? 'border-red-500/50' : 'border-[var(--border-color)]',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent-primary)]/50 cursor-pointer',
          'bg-[var(--bg-secondary)]'
        )}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon}
          <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div className="max-h-60 overflow-auto py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={option.disabled}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    !option.disabled && 'hover:bg-[var(--accent-primary)]/10 cursor-pointer',
                    value === option.value && 'bg-[var(--accent-primary)]/20'
                  )}
                >
                  {option.icon}
                  <span
                    style={{
                      color: value === option.value ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};
