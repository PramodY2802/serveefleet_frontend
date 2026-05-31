import React, { useEffect } from 'react';
import Button from './ui/Button.jsx';

const Modal = ({ title, open, onClose, children, footer, disableClose = false }) => {
  useEffect(() => {
    if (!open || disableClose) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disableClose, open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={() => !disableClose && onClose?.()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-panel__header">
          <h2 id="modal-title" className="modal-panel__title">
            {title}
          </h2>
          <Button variant="ghost" icon="bi-x-lg" iconOnly aria-label="Close" onClick={() => !disableClose && onClose?.()} />
        </div>
        <div className="modal-panel__body">{children}</div>
        {footer && <div className="modal-panel__footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
