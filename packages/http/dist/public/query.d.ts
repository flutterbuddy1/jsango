export declare class HttpQuery {
    private readonly params;
    constructor(searchParamsOrString?: URLSearchParams | string | Record<string, string | readonly string[] | undefined>);
    get(name: string): string | null;
    getAll(name: string): readonly string[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, readonly string[]]>;
    toRecord(): Record<string, string | readonly string[]>;
    toString(): string;
}
//# sourceMappingURL=query.d.ts.map