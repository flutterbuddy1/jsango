import type { AdminField } from './fields.js';
export interface AdminFormFieldConfig {
    readonly name: string;
    readonly label: string;
    readonly required?: boolean | undefined;
    readonly readonly?: boolean | undefined;
    readonly hidden?: boolean | undefined;
    readonly helpText?: string | undefined;
}
export declare class AdminFormField {
    readonly name: string;
    readonly label: string;
    readonly required: boolean;
    readonly readonly: boolean;
    readonly hidden: boolean;
    readonly helpText?: string | undefined;
    constructor(config: AdminFormFieldConfig);
}
export declare class AdminForm {
    readonly fields: readonly AdminFormField[];
    constructor(fields: readonly AdminField[]);
}
//# sourceMappingURL=forms.d.ts.map