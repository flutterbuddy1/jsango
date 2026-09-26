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
  const { resources, route, setRoute, isMobileSidebarOpen, setMobileSidebarOpen } = useAdmin();

  // Group resources by navigationGroup
  const groups: Record<string, typeof resources> = {};
  for (const r of resources) {
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
            className={`nav-link-item ${route === '#profile' || route === '#password-change' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck style={{ width: 15, height: 15 }} />
              <span>Profile & Security</span>
            </span>
          </a>
          <a
            href="#reports"
            className={`nav-link-item ${route === '#reports' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag style={{ width: 15, height: 15 }} />
              <span>Reports & Analytics</span>
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
            href="#security"
            className={`nav-link-item ${route === '#security' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck style={{ width: 15, height: 15 }} />
              <span>Security & Roles</span>
            </span>
          </a>
          <a
            href="#system"
            className={`nav-link-item ${route === '#system' ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu style={{ width: 15, height: 15 }} />
              <span>System Diagnostics</span>
            </span>
          </a>
        </div>
      </aside>
    </>
  );
};
