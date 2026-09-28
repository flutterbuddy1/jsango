import type { LlmMessage, MemoryStore } from '../types.js';
export declare class InMemoryMemoryStore implements MemoryStore {
    private readonly store;
    private readonly maxMessages;
    constructor(maxMessages?: number);
    get(key: string): Promise<LlmMessage[]>;
    set(key: string, messages: LlmMessage[]): Promise<void>;
    clear(key: string): Promise<void>;
    search(query: string, limit?: number): Promise<string[]>;
}
export interface DatabaseMemoryOptions {
    tableName?: string | undefined;
    connection?: any | undefined;
}
export declare class DatabaseMemoryStore implements MemoryStore {
    private inMemoryFallback;
    private readonly connection?;
    constructor(options?: DatabaseMemoryOptions);
    get(key: string): Promise<LlmMessage[]>;
    set(key: string, messages: LlmMessage[]): Promise<void>;
    clear(key: string): Promise<void>;
}
export declare function memory(type?: 'memory' | 'database' | 'cache'): MemoryStore;
//# sourceMappingURL=memory.d.ts.map