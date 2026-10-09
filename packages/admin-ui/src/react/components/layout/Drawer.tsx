import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Open drawers, innermost last: Escape closes only the top one.
const openDrawers: object[] = [];

export interface DrawerProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/** Side panel over the page. Rendered in a portal so a form inside it never nests in another form. */
export const Drawer: React.FC<DrawerProps> = ({ title, onClose, children, width = 560 }) => {
  const id = useRef({}).current;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    openDrawers.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openDrawers.at(-1) === id) close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      openDrawers.splice(openDrawers.indexOf(id), 1);
      window.removeEventListener('keydown', onKey);
    };
  }, [id]);

  return createPortal(
    <div className="admin-drawer-overlay" onClick={onClose}>
      <aside
        className="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${width}px, 100vw)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-drawer-header">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</h2>
          <button
            type="button"
            className="chakra-button ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>
        <div className="admin-drawer-body">{children}</div>
      </aside>
    </div>,
    document.body
  );
};
