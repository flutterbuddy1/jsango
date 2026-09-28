/**
 * Dashboard View for @jsango/admin-ui
 */
import type { DashboardWidgetConfig } from '@jsango/admin-core';
export interface DashboardViewProps {
    readonly widgets: readonly DashboardWidgetConfig[];
    readonly data: Record<string, unknown>;
    readonly isLoading?: boolean | undefined;
}
export declare function renderDashboardView(props: DashboardViewProps): string;
//# sourceMappingURL=dashboard-view.d.ts.map