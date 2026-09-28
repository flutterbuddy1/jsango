export type RuntimeName = 'node' | 'bun' | 'unknown';
export interface IRuntimeAdapter {
    readonly name: RuntimeName;
    readonly version: string;
    getEnv(key: string): string | undefined;
    getAllEnv(): Readonly<Record<string, string | undefined>>;
    cwd(): string;
    exit(code?: number): void;
}
export declare function detectRuntime(): RuntimeName;
//# sourceMappingURL=runtime.d.ts.map