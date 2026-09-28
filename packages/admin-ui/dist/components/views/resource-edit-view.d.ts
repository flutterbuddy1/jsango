/**
 * Resource Edit View for @jsango/admin-ui
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface ResourceEditViewProps {
    readonly schema: AdminResourceSchema;
    readonly item: Record<string, unknown>;
    readonly fieldErrors?: Record<string, string> | undefined;
    readonly isSubmitting?: boolean | undefined;
    readonly generalError?: string | undefined;
}
export declare function renderResourceEditView(props: ResourceEditViewProps): string;
//# sourceMappingURL=resource-edit-view.d.ts.map