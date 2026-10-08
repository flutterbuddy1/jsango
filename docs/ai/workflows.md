# Multi-Agent Workflows & Orchestration

## Sequential & Parallel Pipelines

JSango provides a fluent, type-safe workflow builder for orchestrating multi-agent systems and deterministic pipelines:

```typescript
import { workflow, agent } from 'jsango';

// Define specialist agents
const researcher = agent({
  name: 'Researcher',
  instructions: 'Find facts and references on the topic.',
});
const writer = agent({
  name: 'Writer',
  instructions: 'Draft a compelling blog post from research.',
});
const reviewer = agent({ name: 'Reviewer', instructions: 'Review draft for clarity and tone.' });

// Build workflow
export const ContentPipeline = workflow('content-pipeline')
  .step('research', researcher)
  .parallel('enrichment', {
    seoKeywords: async (_input, state) => ({ keywords: ['TypeScript', 'AI', 'Fullstack'] }),
    factCheck: async (_input, state) => ({ verified: true }),
  })
  .step('draft', writer)
  .step('review', reviewer);

// Execute
const result = await ContentPipeline.execute('The Future of TypeScript Frameworks');
console.log('Final Result:', result.state.review);
```

---

## Conditional Branching & Loops

```typescript
const refundWorkflow = workflow('refund-processor')
  .step('evaluateRisk', async ({ amount }) => ({ riskScore: amount > 500 ? 'HIGH' : 'LOW' }))
  .branch('route', (state) => state.evaluateRisk.riskScore, {
    HIGH: async () => ({ action: 'Escalate to human manager' }),
    LOW: async () => ({ action: 'Auto-approve refund' }),
  });
```
