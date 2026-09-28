export declare const DEFAULT_MAX_BODY_SIZE: number;
export type BodySource = Uint8Array | string | AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null;
export declare class HttpBody {
    private _consumed;
    private readonly source;
    private readonly maxBodySize;
    constructor(source: BodySource, maxBodySize?: number);
    get isConsumed(): boolean;
    private markConsumed;
    bytes(): Promise<Uint8Array>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
    formData(): Promise<Record<string, string | string[]>>;
}
//# sourceMappingURL=body.d.ts.map