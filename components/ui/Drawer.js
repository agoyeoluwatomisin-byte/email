import { useEffect } from 'react';
import IconButton from './IconButton';

export default function Drawer({ open, title, children, onClose }) {
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
      className="ui-drawer-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-drawer-header">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="ui-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
