import { describe, it, expect } from 'vitest';
import { HttpRequest, FakeLlmProvider, agent } from 'jsango';
import { createApplication, checkInventory } from './index.js';

describe('Basic AI App Example', () => {
  it('initializes application and serves root endpoint', async () => {
    const app = createApplication();

    const res = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/' })
    );

    expect(res.status).toBe(200);
    const data = JSON.parse(res.body as string);
    expect(data.message).toContain('JSango All-in-One AI App');
    expect(data.endpoints.docs).toBe('/docs');
  });

  it('serves auto-CRUD for products', async () => {
    const app = createApplication();

    const listRes = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/api/products' })
    );

    expect(listRes.status).toBe(200);
    const listData = JSON.parse(listRes.body as string);
    expect(listData.items.length).toBeGreaterThanOrEqual(3);
  });

  it('validates checkout requests and decrements inventory', async () => {
    const app = createApplication();

    const checkoutRes = await app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/api/checkout',
        body: JSON.stringify({
          userEmail: 'shopper@example.com',
          productName: 'Keychron',
          quantity: 2,
        }),
      })
    );

    expect(checkoutRes.status).toBe(201);
    const checkoutData = JSON.parse(checkoutRes.body as string);
    expect(checkoutData.message).toBe('Order placed successfully!');
    expect(checkoutData.orderId).toBeDefined();
  });

  it('serves OpenAPI Swagger documentation', async () => {
    const app = createApplication();

    const docsRes = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/docs' })
    );

    expect(docsRes.status).toBe(200);
    expect(docsRes.headers.get('content-type')).toContain('text/html');
  });

  it('executes AI agent tool pipeline and queries inventory', async () => {
    const fakeLlm = new FakeLlmProvider();
    // Step 1: Model issues tool call for checkInventory
    fakeLlm.respondWithTool('checkInventory', { productName: 'MacBook' });
    // Step 2: Model receives tool result and provides final answer
    fakeLlm.respond('Yes! We have MacBook Pro M3 in stock for $1999 (5 units available).');

    const testAgent = agent(
      {
        name: 'TestShubh',
        instructions: 'Help customers check inventory',
        tools: { checkInventory },
      },
      fakeLlm
    );

    const result = await testAgent.run('Do you have MacBook in stock?');
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0]?.name).toBe('checkInventory');
    expect((result.toolCalls[0]?.output as any)?.found).toBe(true);
    expect((result.toolCalls[0]?.output as any)?.name).toBe('MacBook Pro M3');
    expect(result.text).toContain('MacBook Pro M3');
  });
});
