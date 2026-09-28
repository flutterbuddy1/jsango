/**
 * Metadata-driven Resource Form Component
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface ResourceFormProps {
    readonly schema: AdminResourceSchema;
    readonly mode: 'create' | 'edit';
    readonly initialData?: Record<string, unknown> | undefined;
    readonly fieldErrors?: Record<string, string> | undefined;
    readonly isSubmitting?: boolean | undefined;
    readonly generalError?: string | undefined;
}
export declare function renderResourceForm(props: ResourceFormProps): string;
//# sourceMappingURL=resource-form.d.ts.map