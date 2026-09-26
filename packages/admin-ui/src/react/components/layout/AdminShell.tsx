import React from 'react';
import { useAdmin } from '../../context/AdminContext.js';
import { Topbar } from './Topbar.js';
import { Sidebar } from './Sidebar.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, removeToast } = useAdmin();

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle style={{ width: 16, height: 16, color: '#10b981' }} />;
      case 'error':
        return <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />;
      case 'warning':
        return <AlertTriangle style={{ width: 16, height: 16, color: '#f59e0b' }} />;
      default:
        return <Info style={{ width: 16, height: 16, color: '#0ea5e9' }} />;
    }
  };

  return (
    <div className="admin-shell">
      {/* Top Header */}
      <Topbar />

      {/* Django-style Breadcrumbs Bar */}
      <Breadcrumbs />

      {/* Main Body */}
      <div className="admin-body">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Content Viewport */}
        <main className="admin-content" id="admin-viewport">
          {children}
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="admin-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="chakra-toast" role="alert">
            {getToastIcon(toast.type)}
            <div style={{ flex: 1, fontSize: '0.8125rem' }}>{toast.text}</div>
            <button
              type="button"
              className="chakra-button ghost"
              style={{ padding: 2, minWidth: 20, height: 20 }}
              onClick={() => removeToast(toast.id)}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
