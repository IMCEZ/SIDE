import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
}) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              'relative w-full rounded-2xl shadow-2xl overflow-hidden',
              'bg-[var(--bg-secondary)] border border-[var(--border-color)]',
              sizes[size]
            )}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 py-4">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
