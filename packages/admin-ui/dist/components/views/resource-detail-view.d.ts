/**
 * Resource Detail View for @jsango/admin-ui
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface ResourceDetailViewProps {
    readonly schema: AdminResourceSchema;
    readonly item: Record<string, unknown>;
    readonly canEdit?: boolean | undefined;
    readonly canDelete?: boolean | undefined;
    readonly canSoftDelete?: boolean | undefined;
}
export declare function renderResourceDetailView(props: ResourceDetailViewProps): string;
//# sourceMappingURL=resource-detail-view.d.ts.map