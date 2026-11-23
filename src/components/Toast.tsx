import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';
import { t } from '../i18n';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const accentBar: Record<ToastMessage['variant'], string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-[#B45309] dark:bg-[#F59E0B]',
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-1.5 max-w-xs w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon =
            toast.variant === 'success'
              ? CheckCircle2
              : toast.variant === 'error'
                ? AlertCircle
                : Info;
          const iconColor =
            toast.variant === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : toast.variant === 'error'
                ? 'text-red-700 dark:text-red-400'
                : 'text-[#B45309] dark:text-[#F59E0B]';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.92 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 32,
                mass: 0.7,
              }}
              className="pointer-events-auto relative flex items-center justify-between gap-2.5 pl-3 pr-1.5 py-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E6E1D8] dark:border-[#2E2A25] shadow-md shadow-black/5 dark:shadow-black/30 text-xs text-[#1C1917] dark:text-[#F5F2EC] overflow-hidden"
            >
              <span
                className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar[toast.variant]}`}
                aria-hidden="true"
              />
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-2 min-w-0"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                <span className="truncate">{toast.text}</span>
              </motion.div>
              {toast.actionLabel && toast.onAction && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    toast.onAction?.();
                    onDismiss(toast.id);
                  }}
                  className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold text-[#B45309] dark:text-[#F59E0B] bg-[#B45309]/10 dark:bg-[#F59E0B]/10 hover:bg-[#B45309]/20 dark:hover:bg-[#F59E0B]/20 transition-colors"
                >
                  {toast.actionLabel}
                </motion.button>
              )}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => onDismiss(toast.id)}
                className="p-0.5 rounded text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
                aria-label={t('Dismiss notification')}
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
