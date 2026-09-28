/**
 * Custom Extension & Plugin architecture for @jsango/admin-ui
 */
import type { AdminFieldConfig, DashboardWidgetConfig } from '@jsango/admin-core';
export type CustomFieldRendererFn = (field: AdminFieldConfig, value: unknown, onChange?: (val: unknown) => void) => string;
export interface AdminUiPlugin {
    readonly id: string;
    readonly name: string;
    readonly customWidgets?: readonly DashboardWidgetConfig[] | undefined;
    readonly customFieldRenderers?: Record<string, CustomFieldRendererFn> | undefined;
    readonly onInit?: ((context: unknown) => void | Promise<void>) | undefined;
}
export declare class AdminUiPluginRegistry {
    private readonly plugins;
    private readonly fieldRenderers;
    registerPlugin(plugin: AdminUiPlugin): this;
    getPlugin(id: string): AdminUiPlugin | undefined;
    getPlugins(): readonly AdminUiPlugin[];
    getFieldRenderer(fieldType: string): CustomFieldRendererFn | undefined;
    clear(): void;
}
//# sourceMappingURL=index.d.ts.map