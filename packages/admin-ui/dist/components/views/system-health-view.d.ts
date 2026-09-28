/**
 * System Health & Diagnostics View for @jsango/admin-ui
 */
import type { AdminSystemHealth } from '../../types/index.js';
export interface SystemHealthViewProps {
    readonly health?: AdminSystemHealth | undefined;
    readonly isLoading?: boolean | undefined;
}
export declare function renderSystemHealthView(props: SystemHealthViewProps): string;
//# sourceMappingURL=system-health-view.d.ts.map