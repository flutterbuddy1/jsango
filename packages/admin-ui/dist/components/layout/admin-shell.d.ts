/**
 * Master Admin Shell Layout
 */
import type { AdminResourceSummary, AdminUserIdentity, ThemeMode, ToastMessage } from '../../types/index.js';
import type { CustomPageSummary } from '../../client/types.js';
export interface AdminShellProps {
    readonly resources: readonly AdminResourceSummary[];
    readonly customPages?: readonly CustomPageSummary[] | undefined;
    readonly activePath: string;
    readonly user?: AdminUserIdentity | undefined;
    readonly themeMode: ThemeMode;
    readonly isSidebarCollapsed?: boolean | undefined;
    readonly contentHtml: string;
    readonly toasts?: readonly ToastMessage[] | undefined;
    readonly modalHtml?: string | undefined;
    readonly appTitle?: string | undefined;
}
export declare function renderAdminShell(props: AdminShellProps): string;
//# sourceMappingURL=admin-shell.d.ts.map