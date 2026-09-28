import type { ILlmProvider, IVectorStore, VectorDocument } from '../types.js';
export interface IngestOptions {
    chunkSize?: number | undefined;
    chunkOverlap?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
}
export interface KnowledgeBaseOptions {
    name: string;
    vectorStore?: IVectorStore | undefined;
    provider?: ILlmProvider | undefined;
    chunkSize?: number | undefined;
    chunkOverlap?: number | undefined;
}
export declare class KnowledgeBase {
    readonly name: string;
    private readonly vectorStore;
    private readonly provider;
    private readonly defaultChunkSize;
    private readonly defaultChunkOverlap;
    constructor(options: KnowledgeBaseOptions);
    ingest(textOrDocs: string | VectorDocument[], options?: IngestOptions): Promise<void>;
    retrieve(query: string, limit?: number): Promise<string[]>;
    clear(): Promise<void>;
    private chunkText;
}
export declare function knowledge(name: string, options?: Omit<KnowledgeBaseOptions, 'name'>): KnowledgeBase;
//# sourceMappingURL=knowledge.d.ts.map