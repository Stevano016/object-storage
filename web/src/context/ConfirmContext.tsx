import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export interface ConfirmOptions {
  title: string;
  /** The consequence, spelled out. This is the sentence people actually read. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive and shows a warning icon. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

/**
 * Replaces window.confirm with a dialog that matches the rest of the dashboard.
 *
 * The native dialog cannot be styled, renders the page origin above the text —
 * which reads like a phishing warning on a deletion prompt — and is suppressed
 * outright by some browsers. Keeping the promise-returning shape means call
 * sites read almost the same as before: `if (await confirm({...}))`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  // Held in a ref because the resolver belongs to one specific open dialog and
  // must survive re-renders without becoming part of the render output.
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<ConfirmFn>(options => {
    // A second request while one is open would orphan the first promise, so the
    // earlier one is answered "no" before the new dialog takes over.
    resolverRef.current?.(false);

    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setPending(options);
    });
  }, []);

  const Icon = pending?.danger ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Modal
          title={pending.title}
          onClose={() => settle(false)}
          closeOnOverlayClick
          footer={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => settle(false)}>
                {pending.cancelLabel || 'Batal'}
              </button>
              <button
                className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
                type="button"
                onClick={() => settle(true)}
                // Enter confirms, which is what someone who has already read the
                // dialog expects; Escape and the overlay both cancel.
                autoFocus
              >
                {pending.confirmLabel || 'Lanjutkan'}
              </button>
            </>
          }
        >
          <div className="confirm-body">
            <Icon className={`confirm-icon${pending.danger ? ' is-danger' : ''}`} />
            <div>{pending.message}</div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return confirm;
}
