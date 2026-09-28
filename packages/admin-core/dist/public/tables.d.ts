export interface AdminColumnConfig {
    readonly name: string;
    readonly label: string;
    readonly sortable?: boolean | undefined;
    readonly align?: 'left' | 'center' | 'right' | undefined;
    readonly width?: string | number | undefined;
    readonly hidden?: boolean | undefined;
}
export declare class AdminColumn {
    readonly name: string;
    readonly label: string;
    readonly sortable: boolean;
    readonly align: 'left' | 'center' | 'right';
    readonly width?: string | number | undefined;
    readonly hidden: boolean;
    constructor(config: AdminColumnConfig);
}
export declare class AdminTable {
    readonly columns: readonly AdminColumn[];
    constructor(columns: readonly AdminColumnConfig[]);
}
//# sourceMappingURL=tables.d.ts.map