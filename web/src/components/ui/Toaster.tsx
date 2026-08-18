import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { ToastType } from '../../types';

const TOAST_ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="toast-container">
      {toasts.map(toast => {
        const Icon = TOAST_ICONS[toast.type];
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Icon style={{ width: 18, height: 18 }} />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
