import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminProvider } from './context/AdminContext.js';
import { AdminApp } from './App.js';
const container = document.getElementById('root');
if (container) {
    const config = window.__JSANGO_ADMIN_CONFIG__ || {};
    const root = createRoot(container);
    root.render(_jsx(React.StrictMode, { children: _jsx(AdminProvider, { config: config, children: _jsx(AdminApp, {}) }) }));
}
//# sourceMappingURL=entry.js.map