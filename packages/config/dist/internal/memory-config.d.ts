import type { IConfigProvider } from '../public/config.js';
import type { IRuntimeAdapter } from '@jsango/runtime';
export declare class MemoryConfigProvider implements IConfigProvider {
    private readonly store;
    constructor(initialValues?: Record<string, unknown>);
    static fromRuntime(runtime: IRuntimeAdapter): MemoryConfigProvider;
    get<T = unknown>(key: string, defaultValue?: T): T;
    getString(key: string, defaultValue?: string): string;
    getNumber(key: string, defaultValue?: number): number;
    getBoolean(key: string, defaultValue?: boolean): boolean;
    has(key: string): boolean;
}
//# sourceMappingURL=memory-config.d.ts.map