export type HeaderValue = string | readonly string[];
export declare class HttpHeaders {
    private readonly headers;
    constructor(initial?: Record<string, string | readonly string[] | undefined> | HttpHeaders);
    private validateName;
    private validateValue;
    get(name: string): string | null;
    getAll(name: string): readonly string[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, string]>;
    rawEntries(): IterableIterator<[string, readonly string[]]>;
    toRecord(): Record<string, string>;
    clone(): HttpHeaders;
}
//# sourceMappingURL=headers.d.ts.map