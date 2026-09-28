import type { IVectorStore, VectorDocument, VectorSearchResult } from '../types.js';
export declare class InMemoryVectorStore implements IVectorStore {
    private readonly docs;
    insert(docs: VectorDocument[]): Promise<void>;
    search(queryEmbedding: number[], limit?: number, minScore?: number): Promise<VectorSearchResult[]>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
}
export declare function cosineSimilarity(a: number[], b: number[]): number;
//# sourceMappingURL=vector-store.d.ts.map