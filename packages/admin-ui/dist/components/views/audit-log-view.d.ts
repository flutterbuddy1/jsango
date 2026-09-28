/**
 * Audit Log View for @jsango/admin-ui
 */
import type { AdminAuditRecord } from '../../types/index.js';
export interface AuditLogViewProps {
    readonly entries: readonly AdminAuditRecord[];
    readonly total: number;
    readonly isLoading?: boolean | undefined;
    readonly selectedEntryId?: string | undefined;
}
export declare function renderAuditLogView(props: AuditLogViewProps): string;
//# sourceMappingURL=audit-log-view.d.ts.map