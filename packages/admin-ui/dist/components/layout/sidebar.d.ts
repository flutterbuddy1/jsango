/**
 * Sidebar navigation component for @jsango/admin-ui
 */
import type { AdminResourceSummary } from '../../types/index.js';
import type { CustomPageSummary } from '../../client/types.js';
export interface SidebarProps {
    readonly resources: readonly AdminResourceSummary[];
    readonly customPages?: readonly CustomPageSummary[] | undefined;
    readonly activePath: string;
    readonly isCollapsed?: boolean | undefined;
    readonly showSystemSection?: boolean | undefined;
    readonly appTitle?: string | undefined;
}
export declare function renderSidebar(props: SidebarProps): string;
//# sourceMappingURL=sidebar.d.ts.map