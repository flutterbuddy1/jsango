/**
 * Metadata-driven Form Field Renderer for @jsango/admin-ui
 */
import type { AdminFieldConfig } from '@jsango/admin-core';
export interface FieldRendererProps {
    readonly field: AdminFieldConfig;
    readonly value: unknown;
    readonly error?: string | undefined;
    readonly disabled?: boolean | undefined;
}
export declare function renderFormField(props: FieldRendererProps): string;
//# sourceMappingURL=field-renderer.d.ts.map