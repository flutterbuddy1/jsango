import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminProvider } from './context/AdminContext.js';
import { AdminApp } from './App.js';

declare global {
  interface Window {
    __JSANGO_ADMIN_CONFIG__?: any;
  }
}

const container = document.getElementById('root');
if (container) {
  const config = window.__JSANGO_ADMIN_CONFIG__ || {};
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AdminProvider config={config}>
        <AdminApp />
      </AdminProvider>
    </React.StrictMode>
  );
}
