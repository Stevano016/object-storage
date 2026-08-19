import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Wraps the body and footer in a <form>, for modals that submit. */
  onSubmit?: (event: React.FormEvent) => void;
  large?: boolean;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  onSubmit,
  large = false,
  closeOnOverlayClick = false
}: ModalProps) {
  // Escape closes any modal. Without it the only way out is the X, which is a
  // poor deal for a dialog opened by accident.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const body = (
    <>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </>
  );

  return (
    <div className="modal-overlay" onClick={closeOnOverlayClick ? onClose : undefined}>
      <div className={`modal-content${large ? ' large' : ''}`} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h3>
          <button className="btn btn-secondary btn-icon-only" onClick={onClose} aria-label="Tutup">
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {/* noValidate: every form validates in its own handler and renders the
            message inline, so the browser's unstyleable bubble never appears. */}
        {onSubmit ? <form onSubmit={onSubmit} noValidate>{body}</form> : body}
      </div>
    </div>
  );
}
