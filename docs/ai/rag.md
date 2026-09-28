# RAG & Vector Search in JSango

JSango provides native document ingestion, chunking, semantic embeddings, and vector similarity retrieval.

---

## Setting Up Knowledge Base

```typescript
import { knowledge, InMemoryVectorStore } from 'jsango';

const vectorStore = new InMemoryVectorStore();

export const companyDocs = knowledge({
  name: 'company-docs',
  vectorStore,
  chunkSize: 500,
  chunkOverlap: 50,
});

// Ingest documents
await companyDocs.ingest({
  id: 'doc_1',
  text: 'JSango is a high-performance TypeScript backend framework with native AI agent orchestration.',
  metadata: { section: 'overview' },
});
```

---

## Semantic Querying

```typescript
const results = await companyDocs.query({
  query: 'What is JSango?',
  limit: 3,
  minScore: 0.7,
});

for (const match of results) {
  console.log(`[Score: ${match.score}] ${match.document.text}`);
}
```

---

## Using Knowledge in Agents

Agents can query knowledge bases directly inside their reasoning loop:

```typescript
import { agent, tool } from 'jsango';

const searchKnowledge = tool({
  name: 'searchDocs',
  description: 'Search internal technical documentation',
  schema: object({ query: string() }),
  execute: async ({ query }) => {
    return await companyDocs.query({ query, limit: 3 });
  },
});

export const docsAgent = agent({
  name: 'DocsBot',
  instructions: 'Answer user questions using companyDocs tool.',
  tools: { searchKnowledge },
});
```
