import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const Dialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
};

export const useDialogContext = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within <Dialog>');
  return ctx;
};

export const DialogTrigger = ({ children }: { children: ReactNode }) => {
  const { setOpen } = useDialogContext();
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
};

export const DialogContent = ({ children }: { children: ReactNode }) => {
  const { open, setOpen } = useDialogContext();
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(15,23,42,0.6)' }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md mx-4 rounded-2xl p-5 shadow-2xl"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export const DialogHeader = ({ children }: { children: ReactNode }) => (
  <div className="mb-3">{children}</div>
);

export const DialogTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-semibold">{children}</h2>
);

export const DialogDescription = ({ children }: { children: ReactNode }) => (
  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
    {children}
  </p>
);

export const DialogFooter = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 flex justify-end gap-2">{children}</div>
);

