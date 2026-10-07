import type { ILlmProvider, IVectorStore, VectorDocument, VectorSearchResult } from '../types.js';
import { InMemoryVectorStore } from './vector-store.js';
import { getDefaultRouter } from '../agents/agent.js';

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

export class KnowledgeBase {
  public readonly name: string;
  private readonly vectorStore: IVectorStore;
  private readonly provider: ILlmProvider;
  private readonly defaultChunkSize: number;
  private readonly defaultChunkOverlap: number;

  constructor(options: KnowledgeBaseOptions) {
    this.name = options.name;
    this.vectorStore = options.vectorStore ?? new InMemoryVectorStore();
    this.provider = options.provider ?? getDefaultRouter();
    this.defaultChunkSize = options.chunkSize ?? 500;
    this.defaultChunkOverlap = options.chunkOverlap ?? 50;
  }

  public async ingest(textOrDocs: string | VectorDocument[], options?: IngestOptions): Promise<void> {
    const chunkSize = options?.chunkSize ?? this.defaultChunkSize;
    const overlap = options?.chunkOverlap ?? this.defaultChunkOverlap;
    const documentsToInsert: VectorDocument[] = [];

    if (typeof textOrDocs === 'string') {
      const chunks = this.chunkText(textOrDocs, chunkSize, overlap);
      for (let i = 0; i < chunks.length; i++) {
        documentsToInsert.push({
          id: `${this.name}_doc_${Date.now()}_${i}`,
          content: chunks[i]!,
          metadata: options?.metadata,
        });
      }
    } else {
      documentsToInsert.push(...textOrDocs);
    }

    // Generate embeddings if provider supports it
    if (this.provider.embed) {
      const contents = documentsToInsert.map((d) => d.content);
      const embeddings = await this.provider.embed(contents);
      for (let i = 0; i < documentsToInsert.length; i++) {
        documentsToInsert[i]!.embedding = embeddings[i];
      }
    }

    await this.vectorStore.insert(documentsToInsert);
  }

  public async retrieve(query: string, limit = 5): Promise<string[]> {
    if (!this.provider.embed) {
      return [];
    }

    const [queryEmbed] = await this.provider.embed(query);
    if (!queryEmbed) return [];

    const searchResults = await this.vectorStore.search(queryEmbed, limit);
    return searchResults.map((r) => r.document.content);
  }

  /**
   * Like retrieve(), but returns the matched documents with their similarity scores (0..1),
   * dropping matches below `minScore`.
   */
  public async search(
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<VectorSearchResult[]> {
    if (!this.provider.embed) return [];
    const [queryEmbed] = await this.provider.embed(query);
    if (!queryEmbed) return [];
    const results = await this.vectorStore.search(queryEmbed, options?.limit ?? 5);
    return results.filter((r) => r.score >= (options?.minScore ?? 0));
  }

  public async clear(): Promise<void> {
    await this.vectorStore.clear();
  }

  private chunkText(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + size, words.length);
      chunks.push(words.slice(start, end).join(' '));
      if (end === words.length) break;
      start += size - overlap;
    }

    return chunks;
  }
}

export function knowledge(name: string, options?: Omit<KnowledgeBaseOptions, 'name'>): KnowledgeBase {
  return new KnowledgeBase({ name, ...options });
}
