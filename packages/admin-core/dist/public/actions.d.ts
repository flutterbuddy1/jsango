import type { AdminActionConfig, AdminBulkActionConfig } from './types.js';
export declare class AdminAction<TInput = unknown, TResult = unknown> {
    readonly id: string;
    readonly label: string;
    readonly description?: string | undefined;
    readonly permission?: string | undefined;
    readonly requiresConfirmation: boolean;
    readonly confirmationMessage?: string | undefined;
    readonly inputSchema?: unknown | undefined;
    readonly handler?: ((options: {
        readonly item: Record<string, unknown>;
        readonly input?: TInput | undefined;
        readonly actor?: unknown | undefined;
    }) => Promise<TResult> | TResult) | undefined;
    constructor(config: AdminActionConfig<TInput, TResult>);
    toJSON(): {
        id: string;
        label: string;
        requiresConfirmation: boolean;
        confirmationMessage?: string | undefined;
    };
}
export declare class AdminBulkAction<TInput = unknown, TResult = unknown> {
    readonly id: string;
    readonly label: string;
    readonly description?: string | undefined;
    readonly permission?: string | undefined;
    readonly requiresConfirmation: boolean;
    readonly confirmationMessage?: string | undefined;
    readonly inputSchema?: unknown | undefined;
    readonly handler?: ((options: {
        readonly ids: readonly (string | number)[];
        readonly input?: TInput | undefined;
        readonly actor?: unknown | undefined;
    }) => Promise<TResult> | TResult) | undefined;
    constructor(config: AdminBulkActionConfig<TInput, TResult>);
    toJSON(): {
        id: string;
        label: string;
        requiresConfirmation: boolean;
        confirmationMessage?: string | undefined;
    };
}
//# sourceMappingURL=actions.d.ts.map