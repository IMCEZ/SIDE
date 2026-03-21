import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'md', className, text }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <motion.div
        className={cn('rounded-full border-2 border-[var(--border-color)] border-t-[var(--accent-primary)]', sizes[size])}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {text && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {text}
        </p>
      )}
    </div>
  );
};

export const PageLoading: React.FC<{ text?: string }> = ({ text = '加载中...' }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          className="text-3xl font-bold tracking-[0.3em]"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          SIDE
        </motion.div>
        <Loading size="sm" text={text} />
      </motion.div>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string; count?: number }> = ({
  className,
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn('rounded-lg bg-[var(--bg-tertiary)]', className)}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </>
  );
};
