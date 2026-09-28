/**
 * Floating bottom Bulk Action Bar for multi-selected records
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface BulkActionBarProps {
    readonly schema: AdminResourceSchema;
    readonly selectedCount: number;
    readonly onExecuteAction?: ((actionId: string) => void) | undefined;
    readonly onClearSelection?: (() => void) | undefined;
    readonly onDeleteSelected?: (() => void) | undefined;
}
export declare function renderBulkActionBar(props: BulkActionBarProps): string;
//# sourceMappingURL=bulk-action-bar.d.ts.map