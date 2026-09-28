import type { IVectorStore, VectorDocument, VectorSearchResult } from '../types.js';

export class InMemoryVectorStore implements IVectorStore {
  private readonly docs = new Map<string, VectorDocument>();

  public async insert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.docs.set(doc.id, doc);
    }
  }

  public async search(
    queryEmbedding: number[],
    limit = 5,
    minScore = 0.0
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const doc of this.docs.values()) {
      if (!doc.embedding || doc.embedding.length === 0) continue;
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      if (score >= minScore) {
        results.push({ document: doc, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  public async delete(id: string): Promise<void> {
    this.docs.delete(id);
  }

  public async clear(): Promise<void> {
    this.docs.clear();
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
