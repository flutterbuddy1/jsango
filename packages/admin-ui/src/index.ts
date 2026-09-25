/**
 * @jsango/admin-ui
 * Enterprise Admin UI foundation for jsango
 */

export type {
  AdminUiConfig,
  AdminResourceSummary,
  AdminUserIdentity,
  AdminListQueryState,
  AdminListResponse,
  AdminAuditRecord,
  AdminSystemHealth,
  AdminMediaItem,
  ToastMessage,
  BreadcrumbItem,
  ThemeMode,
  AdminRoute,
} from './types/index.js';

export {
  AdminApiClient,
  AdminApiError,
  type AdminApiClientOptions,
  type DashboardResponse,
  type CustomPageSummary,
} from './client/index.js';

export {
  QueryClient,
  type QueryOptions,
  type MutationOptions,
  type CacheEntry,
} from './query/index.js';

export {
  type ColorTokens,
  LIGHT_THEME_TOKENS,
  DARK_THEME_TOKENS,
  SPACING_TOKENS,
  RADIUS_TOKENS,
  type ThemeState,
  type ThemeListener,
  ThemeManager,
} from './theme/index.js';

export { type AdminAuthState, type AuthListener, AdminAuthManager } from './auth/index.js';

export { type ToastListener, ToastManager } from './notifications/index.js';

export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatBytes,
  truncateText,
  formatRecordTitle,
} from './formatters/index.js';

export {
  renderButton,
  renderBadge,
  renderInput,
  renderAlert,
  renderSkeleton,
  renderDiffViewer,
  renderJsonViewer,
  computeObjectDiff,
  type ButtonProps,
  type BadgeProps,
  type InputProps,
  type AlertProps,
  type SkeletonProps,
  type DiffEntry,
} from './components/ui/index.js';

export {
  renderConfirmDialog,
  renderDeleteConfirmModal,
  renderCommandPalette,
  buildDefaultCommands,
  type ConfirmDialogOptions,
  type DeleteConfirmOptions,
  type CommandItem,
} from './components/modals/index.js';

export {
  renderDataTable,
  renderFilterBar,
  renderBulkActionBar,
  type DataTableProps,
  type FilterBarProps,
  type BulkActionBarProps,
} from './components/data-table/index.js';

export {
  renderFormField,
  renderResourceForm,
  extractFieldErrors,
  extractGeneralErrorMessage,
  type FieldRendererProps,
  type ResourceFormProps,
} from './components/forms/index.js';

export {
  renderBreadcrumbs,
  renderPageHeader,
  renderSidebar,
  renderTopBar,
  renderAdminShell,
  type PageHeaderProps,
  type SidebarProps,
  type TopBarProps,
  type AdminShellProps,
} from './components/layout/index.js';

export {
  renderDashboardView,
  renderResourceListView,
  renderResourceDetailView,
  renderResourceCreateView,
  renderResourceEditView,
  renderAuditLogView,
  renderSystemHealthView,
  renderLoginView,
  type DashboardViewProps,
  type ResourceListViewProps,
  type ResourceDetailViewProps,
  type ResourceCreateViewProps,
  type ResourceEditViewProps,
  type AuditLogViewProps,
  type SystemHealthViewProps,
  type LoginViewProps,
} from './components/views/index.js';

export {
  AdminUiPluginRegistry,
  type AdminUiPlugin,
  type CustomFieldRendererFn,
} from './plugins/index.js';

export { AdminApp, type AdminAppOptions } from './app/admin-app.js';
