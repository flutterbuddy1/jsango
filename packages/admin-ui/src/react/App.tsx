import React from 'react';
import { useAdmin } from './context/AdminContext.js';
import { AdminShell } from './components/layout/AdminShell.js';
import { DashboardView } from './views/DashboardView.js';
import { DataTable } from './components/data-table/DataTable.js';
import { DynamicForm } from './components/forms/DynamicForm.js';
import { ProfileSecurityView } from './views/ProfileSecurityView.js';
import { AuditTrailView } from './views/AuditTrailView.js';
import { SystemDiagnosticsView } from './views/SystemDiagnosticsView.js';
import { ReportsAnalyticsView } from './views/ReportsAnalyticsView.js';
import { LoginView } from './views/LoginView.js';

export const AppContent: React.FC = () => {
  const { route, resources } = useAdmin();

  // Route Dispatcher
  if (route.startsWith('#changelist/')) {
    const resourceId = route.replace('#changelist/', '');
    const res = resources.find((r) => r.id === resourceId);
    if (!res) {
      return (
        <div className="chakra-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Resource &quot;{resourceId}&quot; not found</h3>
          <p style={{ color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem', marginTop: 4 }}>
            Please make sure this resource is registered in your AdminRegistry.
          </p>
        </div>
      );
    }
    return <DataTable key={res.id} resource={res} />;
  }

  if (route.startsWith('#changeform/')) {
    const parts = route.replace('#changeform/', '').split('/');
    const resourceId = parts[0];
    const recordId = parts[1] || null;
    const res = resources.find((r) => r.id === resourceId);
    if (!res) {
      return (
        <div className="chakra-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Resource &quot;{resourceId}&quot; not found</h3>
        </div>
      );
    }
    return <DynamicForm key={`${res.id}_${recordId || 'new'}`} resource={res} recordId={recordId} />;
  }

  if (route === '#profile' || route === '#password-change') {
    return <ProfileSecurityView />;
  }

  if (route === '#audit') {
    return <AuditTrailView />;
  }

  if (route === '#security') {
    return <ProfileSecurityView />;
  }

  if (route === '#reports') {
    return <ReportsAnalyticsView />;
  }

  if (route === '#system') {
    return <SystemDiagnosticsView />;
  }

  return <DashboardView />;
};

export const AdminApp: React.FC = () => {
  const { isAuthenticated } = useAdmin();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <AdminShell>
      <AppContent />
    </AdminShell>
  );
};
