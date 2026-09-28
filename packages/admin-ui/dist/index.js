/**
 * @jsango/admin-ui
 * Enterprise Admin UI foundation for jsango
 */
export { AdminApiClient, AdminApiError, } from './client/index.js';
export { QueryClient, } from './query/index.js';
export { LIGHT_THEME_TOKENS, DARK_THEME_TOKENS, SPACING_TOKENS, RADIUS_TOKENS, ThemeManager, } from './theme/index.js';
export { AdminAuthManager } from './auth/index.js';
export { ToastManager } from './notifications/index.js';
export { formatDate, formatDateTime, formatRelativeTime, formatNumber, formatCurrency, formatPercent, formatBytes, truncateText, formatRecordTitle, } from './formatters/index.js';
export { renderButton, renderBadge, renderInput, renderAlert, renderSkeleton, renderDiffViewer, renderJsonViewer, computeObjectDiff, } from './components/ui/index.js';
export { renderConfirmDialog, renderDeleteConfirmModal, renderCommandPalette, buildDefaultCommands, } from './components/modals/index.js';
export { renderDataTable, renderFilterBar, renderBulkActionBar, } from './components/data-table/index.js';
export { renderFormField, renderResourceForm, extractFieldErrors, extractGeneralErrorMessage, } from './components/forms/index.js';
export { renderBreadcrumbs, renderPageHeader, renderSidebar, renderTopBar, renderAdminShell, } from './components/layout/index.js';
export { renderDashboardView, renderResourceListView, renderResourceDetailView, renderResourceCreateView, renderResourceEditView, renderAuditLogView, renderSystemHealthView, renderLoginView, } from './components/views/index.js';
export { AdminUiPluginRegistry, } from './plugins/index.js';
export { AdminApp } from './app/admin-app.js';
export { renderAdminSpaHtml, createAdminUiHandler, } from './page/admin-spa.js';
export * from './react/index.js';
//# sourceMappingURL=index.js.map