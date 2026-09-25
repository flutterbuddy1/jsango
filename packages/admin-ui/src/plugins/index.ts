/**
 * Custom Extension & Plugin architecture for @jsango/admin-ui
 */

import type { AdminFieldConfig, DashboardWidgetConfig } from '@jsango/admin-core';

export type CustomFieldRendererFn = (
  field: AdminFieldConfig,
  value: unknown,
  onChange?: (val: unknown) => void
) => string;

export interface AdminUiPlugin {
  readonly id: string;
  readonly name: string;
  readonly customWidgets?: readonly DashboardWidgetConfig[] | undefined;
  readonly customFieldRenderers?: Record<string, CustomFieldRendererFn> | undefined;
  readonly onInit?: ((context: unknown) => void | Promise<void>) | undefined;
}

export class AdminUiPluginRegistry {
  private readonly plugins = new Map<string, AdminUiPlugin>();
  private readonly fieldRenderers = new Map<string, CustomFieldRendererFn>();

  public registerPlugin(plugin: AdminUiPlugin): this {
    this.plugins.set(plugin.id, plugin);

    if (plugin.customFieldRenderers) {
      for (const [fieldType, renderer] of Object.entries(plugin.customFieldRenderers)) {
        this.fieldRenderers.set(fieldType, renderer);
      }
    }

    return this;
  }

  public getPlugin(id: string): AdminUiPlugin | undefined {
    return this.plugins.get(id);
  }

  public getPlugins(): readonly AdminUiPlugin[] {
    return [...this.plugins.values()];
  }

  public getFieldRenderer(fieldType: string): CustomFieldRendererFn | undefined {
    return this.fieldRenderers.get(fieldType);
  }

  public clear(): void {
    this.plugins.clear();
    this.fieldRenderers.clear();
  }
}
