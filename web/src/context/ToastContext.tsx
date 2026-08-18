import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastMessage, ToastType } from '../types';

const TOAST_TTL_MS = 4000;

let toastCounter = 0;
// crypto.randomUUID() is unavailable over plain HTTP, which is how the VPS
// dashboard is usually reached, so ids come from a simple counter instead.
const nextToastId = () => `toast-${++toastCounter}`;

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (text: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((text: string, type: ToastType = 'success') => {
    const id = nextToastId();
    setToasts(prev => [...prev, { id, type, text }]);
    window.setTimeout(() => dismissToast(id), TOAST_TTL_MS);
  }, [dismissToast]);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
