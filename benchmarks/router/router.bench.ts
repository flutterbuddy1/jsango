import { describe, bench } from 'vitest';
import { Router } from '../../packages/router/src/index.js';
import { HttpResponse } from '../../packages/http/src/index.js';

// Setup Routers for Benchmarks

// 1. Single static route
const singleStaticRouter = new Router();
singleStaticRouter.get('/health', () => HttpResponse.text('ok'));
singleStaticRouter.compile();

// 2. 100 static routes
const static100Router = new Router();
for (let i = 0; i < 100; i++) {
  static100Router.get(`/api/v1/resource-${i}/action`, () => HttpResponse.text('ok'));
}
static100Router.compile();

// 3. 1,000 static routes
const static1000Router = new Router();
for (let i = 0; i < 1000; i++) {
  static1000Router.get(`/api/v1/entities/${i}/details`, () => HttpResponse.text('ok'));
}
static1000Router.compile();

// 4. Single parameter route
const singleParamRouter = new Router();
singleParamRouter.get('/users/:id', () => HttpResponse.text('ok'));
singleParamRouter.compile();

// 5. Multiple parameters route
const multiParamRouter = new Router();
multiParamRouter.get('/orgs/:orgId/projects/:projectId/issues/:issueId', () =>
  HttpResponse.text('ok')
);
multiParamRouter.compile();

// 6. Wildcard route
const wildcardRouter = new Router();
wildcardRouter.get('/static/*filepath', () => HttpResponse.text('ok'));
wildcardRouter.compile();

// 7. Mixed route table (50 static, 30 parameterized, 10 wildcards)
const mixedRouter = new Router();
for (let i = 0; i < 50; i++) {
  mixedRouter.get(`/api/v1/static-${i}`, () => HttpResponse.text('ok'));
}
for (let i = 0; i < 30; i++) {
  mixedRouter.get(`/api/v1/users/:userId/items/${i}/:itemId<number>`, () =>
    HttpResponse.text('ok')
  );
}
for (let i = 0; i < 10; i++) {
  mixedRouter.get(`/cdn/bucket-${i}/*path`, () => HttpResponse.text('ok'));
}
mixedRouter.compile();

// 8. 404 router
const notFoundRouter = new Router();
for (let i = 0; i < 50; i++) {
  notFoundRouter.get(`/route-${i}`, () => HttpResponse.text('ok'));
}
notFoundRouter.compile();

// 9. 405 router (POST only)
const methodNotAllowedRouter = new Router();
methodNotAllowedRouter.post('/api/v1/submit', () => HttpResponse.text('ok'));
methodNotAllowedRouter.compile();

// 10. Parameter extraction throughput
const extractionRouter = new Router();
extractionRouter.get('/users/:userId/orders/:orderId/items/:itemId', () => HttpResponse.text('ok'));
extractionRouter.compile();

describe('Router Benchmarks', () => {
  bench('1. Static route matching (1 route)', () => {
    singleStaticRouter.match('GET', '/health');
  });

  bench('2. Static route matching (100 routes)', () => {
    static100Router.match('GET', '/api/v1/resource-75/action');
  });

  bench('3. Static route matching (1,000 routes)', () => {
    static1000Router.match('GET', '/api/v1/entities/850/details');
  });

  bench('4. Parameterized route matching (single parameter)', () => {
    singleParamRouter.match('GET', '/users/usr_987654321');
  });

  bench('5. Parameterized route matching (multiple parameters)', () => {
    multiParamRouter.match('GET', '/orgs/org_42/projects/prj_100/issues/iss_999');
  });

  bench('6. Wildcard route matching', () => {
    wildcardRouter.match('GET', '/static/assets/css/themes/dark/bundle.min.css');
  });

  bench('7. Mixed route table matching (static + param + wildcard)', () => {
    mixedRouter.match('GET', '/api/v1/users/user123/items/15/45678');
  });

  bench('8. Route not found (404)', () => {
    notFoundRouter.match('GET', '/nonexistent/path/that/does/not/exist');
  });

  bench('9. Method not allowed (405)', () => {
    methodNotAllowedRouter.match('GET', '/api/v1/submit');
  });

  bench('10. Parameter extraction throughput', () => {
    const result = extractionRouter.match('GET', '/users/alice/orders/ord_123/items/itm_456');
    if (result.type === 'MATCHED') {
      const _u = result.params['userId'];
      const _o = result.params['orderId'];
      const _i = result.params['itemId'];
      void _u;
      void _o;
      void _i;
    }
  });
});
