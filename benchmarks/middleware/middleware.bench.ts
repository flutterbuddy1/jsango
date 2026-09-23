import { describe, bench } from 'vitest';
import {
  Application,
  MiddlewarePipeline,
  ResponseNormalizer,
} from '../../packages/middleware/src/index.js';
import { HttpRequest, HttpResponse, RequestContext } from '../../packages/http/src/index.js';
import { Container } from '../../packages/container/src/index.js';

// Setup Mock Context and Requests
function createReq(path: string): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: `http://localhost:3000${path}`,
    headers: { host: 'localhost:3000' },
  });
}

// 1. Empty Pipeline
const emptyPipeline = new MiddlewarePipeline();
const emptyCtx = new RequestContext({ request: createReq('/') });
const terminalHandler = async () => HttpResponse.text('ok');

// 2. Single Middleware Pipeline
const singlePipeline = new MiddlewarePipeline();
singlePipeline.use(async (_ctx, next) => next());

// 3. 10-layer Middleware Pipeline
const deepPipeline = new MiddlewarePipeline();
for (let i = 0; i < 10; i++) {
  deepPipeline.use(async (_ctx, next) => {
    const res = await next();
    return res;
  });
}

// 4. App with Middleware + Router + Handler
const app = new Application({ isProduction: true });
app.use(async (_ctx, next) => {
  const res = await next();
  res.headers.set('X-Benchmark', '1');
  return res;
});
app.get('/api/users/:id<number>', (ctx) => {
  return { id: Number(ctx.request.params['id']), name: 'Alice' };
});
const appReq = createReq('/api/users/42');

// 5. App with 5 Middlewares + Handler
const multiApp = new Application({ isProduction: true });
for (let i = 0; i < 5; i++) {
  multiApp.use(async (_ctx, next) => next());
}
multiApp.get('/test', () => 'ok');
const multiReq = createReq('/test');

// 6. Error Path Pipeline
const errorApp = new Application({ isProduction: true });
errorApp.use(async (_ctx, next) => next());
errorApp.get('/crash', () => {
  throw new Error('Database connection failed');
});
const errorReq = createReq('/crash');

// 7. Container Scope Creation and Disposal
const rootContainer = new Container();
rootContainer.registerScoped('service', () => ({ timestamp: Date.now() }));

describe('Middleware & Lifecycle Benchmarks', () => {
  bench('1. Empty middleware pipeline dispatch', async () => {
    await emptyPipeline.execute(emptyCtx, terminalHandler);
  });

  bench('2. Single middleware pipeline dispatch', async () => {
    await singlePipeline.execute(emptyCtx, terminalHandler);
  });

  bench('3. 10-layer middleware pipeline dispatch', async () => {
    await deepPipeline.execute(emptyCtx, terminalHandler);
  });

  bench('4. Full Application lifecycle (Middleware + Router + Scoped DI + Handler)', async () => {
    await app.handle(appReq);
  });

  bench('5. Application dispatch with 5 middlewares + handler', async () => {
    await multiApp.handle(multiReq);
  });

  bench('6. Error pipeline execution (throw -> catch -> mask 500)', async () => {
    await errorApp.handle(errorReq);
  });

  bench('7. Request-scoped container creation and disposal', async () => {
    const scope = rootContainer.createScope();
    scope.resolve('service');
    await scope.dispose();
  });

  bench('8. Response normalization throughput', () => {
    ResponseNormalizer.normalize({ id: 1, name: 'Benchmark', active: true }, emptyCtx);
  });
});
