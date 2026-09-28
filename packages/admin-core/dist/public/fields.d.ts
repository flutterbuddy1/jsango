import type { AdminFieldConfig, AdminFieldType, AdminWidgetType } from './types.js';
/**
 * Determines whether a field name corresponds to a sensitive property.
 */
export declare function isSensitiveFieldName(name: string): boolean;
/**
 * Represents a configured field in an Admin Resource.
 */
export declare class AdminField {
    readonly name: string;
    readonly type: AdminFieldType;
    readonly label: string;
    readonly description?: string | undefined;
    readonly required: boolean;
    readonly readonly: boolean;
    readonly hidden: boolean;
    readonly sensitive: boolean;
    readonly sortable: boolean;
    readonly searchable: boolean;
    readonly filterable: boolean;
    readonly widget: AdminWidgetType;
    readonly enumChoices?: readonly {
        readonly label: string;
        readonly value: string | number;
    }[] | undefined;
    readonly relationTarget?: string | undefined;
    readonly relationType?: 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany' | undefined;
    readonly computedGetter?: ((item: Record<string, unknown>) => unknown) | undefined;
    constructor(config: AdminFieldConfig);
    toJSON(): AdminFieldConfig;
    static formatLabel(name: string): string;
    static defaultWidgetForType(type: AdminFieldType): AdminWidgetType;
}
//# sourceMappingURL=fields.d.ts.map