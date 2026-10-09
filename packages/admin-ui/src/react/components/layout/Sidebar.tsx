import React from 'react';
import { useAdmin } from '../../context/AdminContext.js';
import {
  LayoutDashboard,
  ShieldCheck,
  History,
  Cpu,
  UserCheck,
  Table,
  ShoppingBag,
  Users,
  FileText,
  Layers,
  Package,
  ExternalLink,
  Image,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ style?: React.CSSProperties }>> = {
  'layout-dashboard': LayoutDashboard,
  'shield-check': ShieldCheck,
  history: History,
  cpu: Cpu,
  'user-check': UserCheck,
  table: Table,
  'shopping-bag': ShoppingBag,
  users: Users,
  'file-text': FileText,
  layers: Layers,
  package: Package,
};

export const Sidebar: React.FC = () => {
  const { config, resources, pages, route, setRoute, isMobileSidebarOpen, setMobileSidebarOpen } = useAdmin();
  const byOrder = (a: { navigationOrder?: number | undefined }, b: { navigationOrder?: number | undefined }) => (a.navigationOrder ?? 0) - (b.navigationOrder ?? 0);

  // Custom pages, grouped by navigationGroup
  const pageGroups: Record<string, typeof pages> = {};
  for (const pg of [...pages].sort(byOrder)) (pageGroups[pg.navigationGroup || 'Pages'] ??= []).push(pg);

  // Group resources by navigationGroup
  const groups: Record<string, typeof resources> = {};
  for (const r of [...resources].sort(byOrder)) {
    const groupName = r.navigationGroup || 'Models';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(r);
  }

  const renderIcon = (iconName?: string) => {
    const IconComponent = iconName && ICON_MAP[iconName] ? ICON_MAP[iconName] : Table;
    return <IconComponent style={{ width: 15, height: 15 }} />;
  };

  const isNavActive = (targetHash: string) => {
    return route === targetHash || route.startsWith(targetHash + '/');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop active"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* Core Group */}
        <div>
          <div className="nav-group-heading">Core</div>
          <a
            href="#dashboard"
            className={`nav-link-item ${route === '#dashboard' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LayoutDashboard style={{ width: 15, height: 15 }} />
              <span>Dashboard</span>
            </span>
          </a>
        </div>

        {Object.entries(pageGroups).map(([groupName, items]) => (
          <div key={`pages-${groupName}`}>
            <div className="nav-group-heading">{groupName}</div>
            {items.map((pg) => (
              <a
                key={pg.id}
                href={`#page/${encodeURIComponent(pg.id)}`}
                className={`nav-link-item ${route === `#page/${encodeURIComponent(pg.id)}` ? 'active' : ''}`}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {renderIcon(pg.navigationIcon || 'layout-dashboard')}
                  <span>{pg.label}</span>
                </span>
              </a>
            ))}
          </div>
        ))}

        {/* Dynamic Model Groups */}
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName}>
            <div className="nav-group-heading">{groupName}</div>
            {items.map((r) => {
              const active = isNavActive(`#changelist/${r.id}`) || isNavActive(`#changeform/${r.id}`);
              return (
                <a
                  key={r.id}
                  href={`#changelist/${r.id}`}
                  className={`nav-link-item ${active ? 'active' : ''}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {renderIcon(r.navigationIcon)}
                    <span>{r.pluralLabel || r.label}</span>
                  </span>
                  <button
                    type="button"
                    className="chakra-button ghost"
                    style={{ padding: '2px 6px', fontSize: 11, opacity: 0.7 }}
                    title={`Add ${r.label}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRoute(`#changeform/${r.id}`);
                      setMobileSidebarOpen(false);
                    }}
                  >
                    +
                  </button>
                </a>
              );
            })}
          </div>
        ))}

        {/* Platform Tools Group */}
        <div>
          <div className="nav-group-heading">Platform</div>
          <a
            href="#profile"
            className={`nav-link-item ${route === '#profile' || route === '#password-change' || route === '#security' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck style={{ width: 15, height: 15 }} />
              <span>Profile & Security</span>
            </span>
          </a>
          <a
            href="#media"
            className={`nav-link-item ${route === '#media' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Image style={{ width: 15, height: 15 }} />
              <span>Media</span>
            </span>
          </a>
          <a
            href="#audit"
            className={`nav-link-item ${route === '#audit' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History style={{ width: 15, height: 15 }} />
              <span>Audit Trail</span>
            </span>
          </a>
          <a
            href="#system"
            className={`nav-link-item ${route === '#system' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu style={{ width: 15, height: 15 }} />
              <span>System</span>
            </span>
          </a>
          <a href={config.siteUrl} target="_blank" rel="noopener noreferrer" className="nav-link-item mobile-only">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ExternalLink style={{ width: 15, height: 15 }} />
              <span>View site</span>
            </span>
          </a>
        </div>
      </aside>
    </>
  );
};
