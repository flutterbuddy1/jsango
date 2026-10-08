# RAG & Vector Search in JSango

JSango provides native document ingestion, chunking, semantic embeddings, and vector similarity retrieval.

---

## Setting Up Knowledge Base

```typescript
import { knowledge, InMemoryVectorStore } from 'jsango';

export const companyDocs = knowledge('company-docs', {
  vectorStore: new InMemoryVectorStore(), // default; plug in your own IVectorStore
  chunkSize: 500, // words per chunk
  chunkOverlap: 50,
});

// Ingest raw text (chunked and embedded automatically)
await companyDocs.ingest(
  'JSango is a high-performance TypeScript backend framework with native AI agent orchestration.',
  { metadata: { section: 'overview' } }
);

// ...or documents you have already split
await companyDocs.ingest([
  {
    id: 'faq_1',
    content: 'Refunds are processed within 5 business days.',
    metadata: { section: 'faq' },
  },
]);
```

Embeddings come from the knowledge base's `provider` (default: the default model router), so the
provider must implement `embed()` (OpenAI, Gemini, Ollama and the fake provider do).

---

## Semantic Querying

```typescript
// Scored matches
const results = await companyDocs.search('What is JSango?', { limit: 3, minScore: 0.7 });
for (const match of results) {
  console.log(`[Score: ${match.score.toFixed(2)}] ${match.document.content}`);
}

// Just the matching text
const passages: string[] = await companyDocs.retrieve('refund policy', 3);
```

---

## Using Knowledge in Agents

Agents can query knowledge bases directly inside their reasoning loop:

```typescript
import { agent, tool, object, string } from 'jsango';

const searchKnowledge = tool({
  name: 'searchDocs',
  description: 'Search internal technical documentation',
  schema: object({ query: string() }),
  execute: async ({ query }: { query: string }) => {
    return await companyDocs.retrieve(query, 3);
  },
});

export const docsAgent = agent({
  name: 'DocsBot',
  instructions: 'Answer user questions using companyDocs tool.',
  tools: { searchKnowledge },
});
```
