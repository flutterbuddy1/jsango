/**
 * Resource Create View for @jsango/admin-ui
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface ResourceCreateViewProps {
    readonly schema: AdminResourceSchema;
    readonly initialData?: Record<string, unknown> | undefined;
    readonly fieldErrors?: Record<string, string> | undefined;
    readonly isSubmitting?: boolean | undefined;
    readonly generalError?: string | undefined;
}
export declare function renderResourceCreateView(props: ResourceCreateViewProps): string;
//# sourceMappingURL=resource-create-view.d.ts.map