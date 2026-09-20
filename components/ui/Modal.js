import { useEffect } from 'react';
import IconButton from './IconButton';

export default function Modal({ open, title, children, onClose, actions }) {
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="ui-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="ui-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-modal-header">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="ui-modal-body">{children}</div>
        {actions && <footer className="ui-modal-actions">{actions}</footer>}
      </section>
    </div>
  );
}
