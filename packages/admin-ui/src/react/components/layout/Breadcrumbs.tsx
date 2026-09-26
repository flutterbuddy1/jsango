import React from 'react';
import { useAdmin } from '../../context/AdminContext.js';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, setRoute } = useAdmin();

  return (
    <div className="admin-breadcrumbs-bar">
      <div className="breadcrumbs-trail">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setRoute('#dashboard');
          }}
        >
          Home
        </a>
        {breadcrumbs.map((item, idx) => (
          <React.Fragment key={idx}>
            <span>›</span>
            {item.href && idx < breadcrumbs.length - 1 ? (
              <a
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.href) setRoute(item.href);
                }}
              >
                {item.label}
              </a>
            ) : (
              <span className="current">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          fontSize: '0.6875rem',
          color: 'var(--chakra-colors-brand-fg)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        ● JSango ORM Active
      </div>
    </div>
  );
};
