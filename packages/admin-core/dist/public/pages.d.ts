export interface AdminPageConfig {
    readonly id: string;
    readonly path: string;
    readonly label: string;
    readonly navigationGroup?: string | undefined;
    readonly navigationIcon?: string | undefined;
    readonly navigationOrder?: number | undefined;
    readonly permission?: string | undefined;
}
export declare class AdminPage {
    readonly id: string;
    readonly path: string;
    readonly label: string;
    readonly navigationGroup?: string | undefined;
    readonly navigationIcon?: string | undefined;
    readonly navigationOrder?: number | undefined;
    readonly permission?: string | undefined;
    constructor(config: AdminPageConfig);
    toJSON(): AdminPageConfig;
}
//# sourceMappingURL=pages.d.ts.map