import type { IRuntimeAdapter, RuntimeName } from '../public/runtime.js';
export declare class NodeRuntimeAdapter implements IRuntimeAdapter {
    readonly name: RuntimeName;
    get version(): string;
    getEnv(key: string): string | undefined;
    getAllEnv(): Readonly<Record<string, string | undefined>>;
    cwd(): string;
    exit(code?: number): void;
}
//# sourceMappingURL=node-adapter.d.ts.map