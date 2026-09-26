import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.js';
import {
  Menu,
  Moon,
  Sun,
  ExternalLink,
  Search,
  X,
  LogOut,
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const {
    config,
    theme,
    toggleTheme,
    user,
    logout,
    setMobileSidebarOpen,
    isMobileSidebarOpen,
    resources,
    setRoute,
  } = useAdmin();

  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Filter items for ⌘K
  const filteredResources = resources.filter(
    (r) =>
      r.label.toLowerCase().includes(paletteQuery.toLowerCase()) ||
      r.pluralLabel.toLowerCase().includes(paletteQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  React.useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  return (
    <>
      <header className="admin-topbar">
        {/* Left: Mobile Hamburger & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="mobile-hamburger-btn chakra-button subtle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>

          <a href="#dashboard" className="header-brand" style={{ textDecoration: 'none' }}>
            <div className="header-brand-badge">JS</div>
            <div>
              <div className="header-brand-title">{config.title}</div>
              <div
                className="header-brand-subtitle"
                style={{ fontSize: '0.65rem', color: 'var(--chakra-colors-fg-muted)' }}
              >
                {config.brandSubtitle}
              </div>
            </div>
          </a>
        </div>

        {/* Right: Quick Actions & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* External Site link */}
          <a
            href={config.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="chakra-button subtle"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          >
            <ExternalLink style={{ width: 13, height: 13 }} />
            <span className="desktop-only-text">View Site</span>
          </a>

          {/* Command Palette Trigger */}
          {config.enableCommandPalette && (
            <button
              type="button"
              className="chakra-button subtle"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                color: 'var(--chakra-colors-fg-muted)',
              }}
              onClick={() => {
                setPaletteQuery('');
                setCommandPaletteOpen(true);
              }}
              title="Command Palette (⌘K)"
            >
              <Search style={{ width: 14, height: 14 }} />
              <kbd
                style={{
                  fontFamily: 'var(--chakra-fonts-mono)',
                  fontSize: '0.6875rem',
                  background: 'var(--chakra-colors-bg-muted)',
                  padding: '1px 4px',
                  borderRadius: 4,
                }}
              >
                ⌘K
              </kbd>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            type="button"
            className="chakra-button subtle"
            style={{ padding: '0.4rem 0.6rem' }}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun style={{ width: 15, height: 15 }} />
            ) : (
              <Moon style={{ width: 15, height: 15 }} />
            )}
          </button>

          {/* User Avatar linking to Profile */}
          <a
            href="#profile"
            title={`${user.name} (${user.role}) - Manage Profile & 2FA`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              paddingLeft: '0.4rem',
              borderLeft: '1px solid var(--chakra-colors-border-subtle)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '9999px',
                background: 'var(--chakra-colors-brand-solid)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.75rem',
                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.3)',
                transition: 'transform 0.15s ease',
              }}
            >
              {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'SU'}
            </div>
          </a>

          {/* Logout Button */}
          <button
            type="button"
            className="chakra-button subtle"
            style={{ padding: '0.4rem 0.6rem', color: '#ef4444' }}
            onClick={() => {
              if (confirm('Are you sure you want to log out of the admin console?')) {
                logout();
              }
            }}
            title="Log Out of Admin Console"
          >
            <LogOut style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </header>

      {/* Command Palette Modal Dialog */}
      {isCommandPaletteOpen && (
        <div
          className="admin-modal-overlay"
          style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '10vh' }}
          onClick={() => setCommandPaletteOpen(false)}
          onKeyDown={handleKeyDown}
        >
          <div
            className="chakra-card"
            style={{
              maxWidth: 560,
              width: '100%',
              padding: '0',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--chakra-colors-border-subtle)',
                gap: '0.75rem',
              }}
            >
              <Search style={{ width: 18, height: 18, color: 'var(--chakra-colors-fg-muted)' }} />
              <input
                type="text"
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Search models, views, platform tools..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.9375rem',
                  color: 'var(--chakra-colors-fg-default)',
                }}
              />
              <button
                type="button"
                className="chakra-button ghost"
                style={{ padding: 4 }}
                onClick={() => setCommandPaletteOpen(false)}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Quick Navigation Results */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0.5rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--chakra-colors-fg-muted)',
                  padding: '0.4rem 0.6rem',
                }}
              >
                Models & Resources
              </div>
              {filteredResources.length === 0 ? (
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)' }}>
                  No matching models found.
                </div>
              ) : (
                filteredResources.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setRoute(`#changelist/${res.id}`);
                      setCommandPaletteOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'background 0.1s ease',
                    }}
                    className="nav-link-item"
                  >
                    <span style={{ fontWeight: 600 }}>{res.pluralLabel || res.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
                      {res.navigationGroup || 'Models'}
                    </span>
                  </div>
                ))
              )}

              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--chakra-colors-fg-muted)',
                  padding: '0.6rem 0.6rem 0.4rem',
                  borderTop: '1px solid var(--chakra-colors-border-subtle)',
                  marginTop: '0.25rem',
                }}
              >
                Platform Views
              </div>
              <div
                onClick={() => {
                  setRoute('#profile');
                  setCommandPaletteOpen(false);
                }}
                className="nav-link-item"
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderRadius: 6, fontSize: '0.875rem' }}
              >
                Profile, Password & 2FA
              </div>
              <div
                onClick={() => {
                  setRoute('#audit');
                  setCommandPaletteOpen(false);
                }}
                className="nav-link-item"
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderRadius: 6, fontSize: '0.875rem' }}
              >
                Audit Trail Logs
              </div>
              <div
                onClick={() => {
                  setRoute('#system');
                  setCommandPaletteOpen(false);
                }}
                className="nav-link-item"
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderRadius: 6, fontSize: '0.875rem' }}
              >
                System Diagnostics
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
