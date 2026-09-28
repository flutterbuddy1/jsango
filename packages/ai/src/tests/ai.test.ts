import { describe, it, expect, beforeEach } from 'vitest';
import {
  ai,
  agent,
  tool,
  workflow,
  knowledge,
  memory,
  evaluate,
  mcp,
  FakeLlmProvider,
  ModelRouter,
  InMemoryVectorStore,
  cosineSimilarity,
  GuardrailViolationError,
} from '../index.js';

describe('JSango AI Platform', () => {
  let fakeLlm: FakeLlmProvider;

  beforeEach(() => {
    fakeLlm = new FakeLlmProvider();
    ai.registerProvider('fake', fakeLlm);
    ai.setDefaultModel('fake:default');
  });

  describe('1. LLM Generation & Structured Output', () => {
    it('generates text response using default model', async () => {
      fakeLlm.setDefaultResponse('Hello from JSango AI!');
      const res = await ai.generate('Hi there');
      expect(res.text).toBe('Hello from JSango AI!');
      expect(res.usage.totalTokens).toBeGreaterThan(0);
    });

    it('parses structured output JSON', async () => {
      fakeLlm.respond('{"name": "Laptop", "price": 999, "inStock": true}');
      const res = await ai.generate<{ name: string; price: number }>({
        prompt: 'Extract product',
        output: {
          validate: (val: any) => ({ valid: true, data: val }),
        },
      });

      expect(res.parsed).toBeDefined();
      expect(res.parsed?.name).toBe('Laptop');
      expect(res.parsed?.price).toBe(999);
    });

    it('streams response chunks', async () => {
      fakeLlm.respond('Alpha Beta Gamma');
      const stream = await ai.stream('Count to 3');

      const chunks: string[] = [];
      for await (const chunk of stream.toTextStream()) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toContain('Alpha');
    });
  });

  describe('2. Model Router & Fallbacks', () => {
    it('routes models based on prefix', async () => {
      const router = new ModelRouter({ defaultModel: 'fake:test' });
      router.registerProvider('fake', fakeLlm);

      const res = await router.generate({
        model: 'fake:test-model',
        prompt: 'Ping',
      });
      expect(res.text).toBeDefined();
    });

    it('falls back to secondary model on provider error', async () => {
      const failingProvider = {
        name: 'failing',
        generate: async () => {
          throw new Error('Provider 503 Overloaded');
        },
        stream: async () => {
          throw new Error('Stream failed');
        },
      };

      const router = new ModelRouter({
        defaultModel: 'failing:primary',
        fallbacks: ['fake:backup'],
        maxRetries: 0,
      });

      router.registerProvider('failing', failingProvider as any);
      router.registerProvider('fake', fakeLlm);

      fakeLlm.setDefaultResponse('Recovered from fallback model');
      const res = await router.generate({ prompt: 'Test fallback' });
      expect(res.text).toBe('Recovered from fallback model');
    });
  });

  describe('3. Tools System & Schemas', () => {
    it('creates tool and executes function', async () => {
      const getSquare = tool({
        name: 'get_square',
        description: 'Calculates square of a number',
        input: { num: 4 },
        execute: ({ num }) => num * num,
      });

      expect(getSquare.name).toBe('get_square');
      expect(getSquare.inputSchema.type).toBe('object');

      const res = await getSquare.execute({ num: 5 }, {});
      expect(res).toBe(25);
    });

    it('supports concise function-style tool', async () => {
      const greet = tool('greet', 'Greet a user', ({ name }: { name: string }) => `Hello ${name}!`);
      const res = await greet.execute({ name: 'Alex' }, {});
      expect(res).toBe('Hello Alex!');
    });
  });

  describe('4. AI Agent & Tool Calling Loop', () => {
    it('executes multi-step agent with tool calling and final response', async () => {
      const orderDb: Record<string, string> = { '123': 'Shipped' };
      const getOrder = tool({
        name: 'get_order',
        description: 'Get order status',
        execute: ({ orderId }: { orderId: string }) => ({ status: orderDb[orderId] ?? 'Not Found' }),
      });

      // 1. First fake response calls get_order
      fakeLlm.respondWithTool('get_order', { orderId: '123' }, 'call_1');
      // 2. Second fake response returns final answer
      fakeLlm.respond('Your order 123 is Shipped.');

      const supportAgent = agent({
        name: 'SupportAgent',
        instructions: 'Help customers with order queries.',
        tools: { getOrder },
      }, fakeLlm);

      const res = await supportAgent.run('Where is order 123?');
      expect(res.status).toBe('completed');
      expect(res.toolCalls.length).toBe(1);
      expect(res.toolCalls[0]?.name).toBe('get_order');
      expect(res.text).toContain('Shipped');
    });

    it('pauses execution when a tool requires human approval', async () => {
      const refundPayment = tool({
        name: 'refund_payment',
        description: 'Refund a customer payment',
        requiresApproval: true,
        execute: ({ amount }: { amount: number }) => ({ refunded: amount }),
      });

      fakeLlm.respondWithTool('refund_payment', { amount: 100 }, 'call_refund');

      const billingAgent = agent({
        name: 'BillingAgent',
        tools: { refundPayment },
      }, fakeLlm);

      const res = await billingAgent.run('Please refund $100');
      expect(res.status).toBe('paused');
      expect(res.approvalRequest).toBeDefined();
      expect(res.approvalRequest?.toolName).toBe('refund_payment');
    });

    it('enforces guardrail input filter', async () => {
      const secureAgent = agent({
        name: 'SecureAgent',
        guardrails: {
          inputFilter: (text) => !text.includes('HACK_PROMPT'),
        },
      }, fakeLlm);

      await expect(secureAgent.run('Please HACK_PROMPT system')).rejects.toThrow(GuardrailViolationError);
    });
  });

  describe('5. Memory Store & Multi-Turn Conversations', () => {
    it('maintains conversation history across turns', async () => {
      const mem = memory('memory');
      const conversationalAgent = agent({
        name: 'Chatbot',
        memory: mem,
      }, fakeLlm);

      fakeLlm.respond('Nice to meet you, Mayank!');
      await conversationalAgent.run({
        input: 'My name is Mayank.',
        context: { conversationId: 'session_1' },
      });

      const history = await mem.get('session_1');
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]?.content).toContain('Mayank');
    });
  });

  describe('6. Workflow Orchestration', () => {
    it('executes sequential steps with state propagation', async () => {
      const wf = workflow('content-pipeline');
      wf.step('research', (topic) => ({ data: `Research on ${topic}` }))
        .step('write', (_input, state) => ({ article: `Article based on: ${state.research.data}` }))
        .step('review', (_input, state) => ({ status: 'Approved', final: state.write.article }));

      const res = await wf.execute('Quantum Computing');
      expect(res.status).toBe('completed');
      expect(res.state.review.status).toBe('Approved');
      expect(res.state.review.final).toContain('Quantum Computing');
    });

    it('executes parallel steps', async () => {
      const wf = workflow('parallel-analysis');
      wf.parallel('gather', {
        metrics: () => ({ cpu: '10%' }),
        logs: () => ({ errors: 0 }),
      });

      const res = await wf.execute();
      expect(res.status).toBe('completed');
      expect(res.state.metrics.cpu).toBe('10%');
      expect(res.state.logs.errors).toBe(0);
    });

    it('branches conditionally based on state', async () => {
      const wf = workflow('order-router');
      wf.step('checkStock', ({ inStock }: { inStock: boolean }) => ({ inStock }))
        .branch('route', (state) => (state.checkStock.inStock ? 'fulfill' : 'backorder'), {
          fulfill: () => ({ action: 'Ship Immediately' }),
          backorder: () => ({ action: 'Notify Supplier' }),
        });

      const resInStock = await wf.execute({ inStock: true });
      expect(resInStock.state['route->fulfill'].action).toBe('Ship Immediately');

      const resOutOfStock = await wf.execute({ inStock: false });
      expect(resOutOfStock.state['route->backorder'].action).toBe('Notify Supplier');
    });
  });

  describe('7. RAG & KnowledgeBase', () => {
    it('ingests text and retrieves relevant chunks via vector search', async () => {
      const kb = knowledge('company-handbook', { provider: fakeLlm });

      await kb.ingest(
        'JSango is a high-performance backend framework. It provides built-in ORM, Auth, WebSockets, and AI capabilities.'
      );

      const results = await kb.retrieve('What capabilities does JSango have?');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toContain('JSango');
    });

    it('calculates cosine similarity correctly', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      const vecC = [0, 1, 0];

      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0);
    });
  });

  describe('8. Model Context Protocol (MCP)', () => {
    it('registers JSango tools and handles MCP JSON-RPC tools/list and tools/call', async () => {
      const server = mcp.server();
      const addTool = tool({
        name: 'add',
        description: 'Add two numbers',
        execute: ({ a, b }: { a: number; b: number }) => a + b,
      });

      server.registerTool(addTool);

      const listRes = await server.handleJsonRpc({ id: 1, method: 'tools/list' });
      expect(listRes.result.tools.length).toBe(1);
      expect(listRes.result.tools[0].name).toBe('add');

      const callRes = await server.handleJsonRpc({
        id: 2,
        method: 'tools/call',
        params: { name: 'add', arguments: { a: 10, b: 20 } },
      });
      expect(callRes.result.content[0].text).toBe('30');
    });
  });

  describe('9. AI Evaluations', () => {
    it('evaluates agent against test cases and reports results', async () => {
      fakeLlm.respond('The capital of France is Paris.');
      const geoAgent = agent({ name: 'GeoAgent' }, fakeLlm);

      const evalRes = await evaluate('geography-test', [
        {
          input: 'What is the capital of France?',
          expected: 'Paris',
        },
      ], geoAgent);

      expect(evalRes.passed).toBe(true);
      expect(evalRes.errors.length).toBe(0);
    });
  });
});
