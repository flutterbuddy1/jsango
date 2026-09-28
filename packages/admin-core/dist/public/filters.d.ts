import type { AdminFilterConfig, AdminFilterType } from './types.js';
export declare class AdminFilter {
    readonly name: string;
    readonly type: AdminFilterType;
    readonly field: string;
    readonly label: string;
    readonly choices?: readonly {
        readonly label: string;
        readonly value: string | number;
    }[] | undefined;
    constructor(config: AdminFilterConfig);
    toJSON(): AdminFilterConfig;
}
//# sourceMappingURL=filters.d.ts.map