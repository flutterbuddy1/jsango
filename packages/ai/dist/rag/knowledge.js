import { InMemoryVectorStore } from './vector-store.js';
import { getDefaultRouter } from '../agents/agent.js';
export class KnowledgeBase {
    name;
    vectorStore;
    provider;
    defaultChunkSize;
    defaultChunkOverlap;
    constructor(options) {
        this.name = options.name;
        this.vectorStore = options.vectorStore ?? new InMemoryVectorStore();
        this.provider = options.provider ?? getDefaultRouter();
        this.defaultChunkSize = options.chunkSize ?? 500;
        this.defaultChunkOverlap = options.chunkOverlap ?? 50;
    }
    async ingest(textOrDocs, options) {
        const chunkSize = options?.chunkSize ?? this.defaultChunkSize;
        const overlap = options?.chunkOverlap ?? this.defaultChunkOverlap;
        const documentsToInsert = [];
        if (typeof textOrDocs === 'string') {
            const chunks = this.chunkText(textOrDocs, chunkSize, overlap);
            for (let i = 0; i < chunks.length; i++) {
                documentsToInsert.push({
                    id: `${this.name}_doc_${Date.now()}_${i}`,
                    content: chunks[i],
                    metadata: options?.metadata,
                });
            }
        }
        else {
            documentsToInsert.push(...textOrDocs);
        }
        // Generate embeddings if provider supports it
        if (this.provider.embed) {
            const contents = documentsToInsert.map((d) => d.content);
            const embeddings = await this.provider.embed(contents);
            for (let i = 0; i < documentsToInsert.length; i++) {
                documentsToInsert[i].embedding = embeddings[i];
            }
        }
        await this.vectorStore.insert(documentsToInsert);
    }
    async retrieve(query, limit = 5) {
        if (!this.provider.embed) {
            return [];
        }
        const [queryEmbed] = await this.provider.embed(query);
        if (!queryEmbed)
            return [];
        const searchResults = await this.vectorStore.search(queryEmbed, limit);
        return searchResults.map((r) => r.document.content);
    }
    async clear() {
        await this.vectorStore.clear();
    }
    chunkText(text, size, overlap) {
        const words = text.split(/\s+/);
        const chunks = [];
        let start = 0;
        while (start < words.length) {
            const end = Math.min(start + size, words.length);
            chunks.push(words.slice(start, end).join(' '));
            if (end === words.length)
                break;
            start += size - overlap;
        }
        return chunks;
    }
}
export function knowledge(name, options) {
    return new KnowledgeBase({ name, ...options });
}
//# sourceMappingURL=knowledge.js.map