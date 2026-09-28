export class InMemoryVectorStore {
    docs = new Map();
    async insert(docs) {
        for (const doc of docs) {
            this.docs.set(doc.id, doc);
        }
    }
    async search(queryEmbedding, limit = 5, minScore = 0.0) {
        const results = [];
        for (const doc of this.docs.values()) {
            if (!doc.embedding || doc.embedding.length === 0)
                continue;
            const score = cosineSimilarity(queryEmbedding, doc.embedding);
            if (score >= minScore) {
                results.push({ document: doc, score });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }
    async delete(id) {
        this.docs.delete(id);
    }
    async clear() {
        this.docs.clear();
    }
}
export function cosineSimilarity(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}
//# sourceMappingURL=vector-store.js.map