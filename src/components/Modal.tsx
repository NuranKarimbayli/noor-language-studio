import { ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Stack of currently-open modals. Escape only closes the topmost layer,
// so nested confirmations (e.g. reset statistics) dismiss before their parent.
const openModalStack: symbol[] = [];

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the dialog panel (width, padding, scroll, etc.) */
  panelClassName?: string;
  ariaLabel?: string;
}

const backdropTransition = { duration: 0.18, ease: 'easeOut' as const };
const panelTransition = { type: 'spring' as const, stiffness: 380, damping: 30 };

export function Modal({
  open,
  onClose,
  children,
  panelClassName = '',
  ariaLabel,
}: ModalProps) {
  const stackIdRef = useRef<symbol | null>(null);
  if (!stackIdRef.current) stackIdRef.current = Symbol('modal');

  useEffect(() => {
    if (!open) return;
    const id = stackIdRef.current!;
    openModalStack.push(id);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (openModalStack[openModalStack.length - 1] !== id) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const i = openModalStack.indexOf(id);
      if (i !== -1) openModalStack.splice(i, 1);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          onClick={onClose}
        >
          {/* p-4 on the scroll container + my-auto on the panel keeps the
              dialog vertically centered when it fits, but lets the user
              scroll to the top when content exceeds the viewport (prevents
              header clipping). */}
          <div className="flex-1 flex justify-center p-4">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl shadow-xl ${panelClassName}`}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={panelTransition}
          >
            {children}
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
