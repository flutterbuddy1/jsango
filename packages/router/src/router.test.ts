import { describe, it, expect } from 'vitest';
import {
  Router,
  DuplicateRouteError,
  DuplicateRouteNameError,
  RouteNotFoundError,
  RouterLockedError,
  InvalidRoutePatternError,
  type RouteHandler,
} from './index.js';
import { HttpRequest, HttpResponse, HttpStatus, RequestContext } from '@django-js/http';

function createMockContext(method: string, url: string): RequestContext {
  const req = new HttpRequest({
    method,
    url,
    headers: { host: 'localhost:3000' },
  });
  return new RequestContext({ request: req });
}

describe('Router', () => {
  describe('Static Routes', () => {
    it('should register and match root route', () => {
      const router = new Router();
      const handler: RouteHandler = () => HttpResponse.text('root');
      router.get('/', handler);

      const match = router.match('GET', '/');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.handler).toBe(handler);
        expect(match.params).toEqual({});
      }
    });

    it('should register and match nested static routes', () => {
      const router = new Router();
      const handler: RouteHandler = () => HttpResponse.text('profile');
      router.get('/api/v1/users/profile', handler);

      const match = router.match('GET', '/api/v1/users/profile');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.handler).toBe(handler);
      }
    });

    it('should normalize paths (leading slashes, trailing slashes, duplicate slashes)', () => {
      const router = new Router();
      const handler: RouteHandler = () => HttpResponse.text('users');
      router.get('users', handler); // missing leading slash

      // Match with trailing slash and multiple slashes
      const match1 = router.match('GET', '/users/');
      const match2 = router.match('GET', '//users///');
      expect(match1.type).toBe('MATCHED');
      expect(match2.type).toBe('MATCHED');
    });

    it('should throw DuplicateRouteError when registering same method and path twice', () => {
      const router = new Router();
      router.get('/health', () => HttpResponse.text('ok'));
      expect(() => {
        router.get('/health', () => HttpResponse.text('duplicate'));
      }).toThrow(DuplicateRouteError);
    });
  });

  describe('Named Parameters', () => {
    it('should extract single parameter', () => {
      const router = new Router();
      router.get('/users/:id', () => HttpResponse.text('user'));

      const match = router.match('GET', '/users/123');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.params).toEqual({ id: '123' });
      }
    });

    it('should extract multiple parameters', () => {
      const router = new Router();
      router.get('/orgs/:orgId/repos/:repoId', () => HttpResponse.text('repo'));

      const match = router.match('GET', '/orgs/42/repos/99');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.params).toEqual({ orgId: '42', repoId: '99' });
      }
    });

    it('should decode URL-encoded parameter values safely', () => {
      const router = new Router();
      router.get('/search/:query', () => HttpResponse.text('search'));

      const match = router.match('GET', '/search/hello%20world');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.params).toEqual({ query: 'hello world' });
      }
    });

    it('should handle malformed URL encoding gracefully without throwing', () => {
      const router = new Router();
      router.get('/items/:code', () => HttpResponse.text('item'));

      // %ZZ is invalid percent-encoding
      const match = router.match('GET', '/items/item%ZZ');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.params).toEqual({ code: 'item%ZZ' });
      }
    });
  });

  describe('Optional Parameters', () => {
    it('should match route both with and without trailing optional parameter', () => {
      const router = new Router();
      router.get('/articles/:slug?', () => HttpResponse.text('article'));

      // Without optional param
      const match1 = router.match('GET', '/articles');
      expect(match1.type).toBe('MATCHED');
      if (match1.type === 'MATCHED') {
        expect(match1.params).toEqual({});
      }

      // With optional param
      const match2 = router.match('GET', '/articles/my-first-post');
      expect(match2.type).toBe('MATCHED');
      if (match2.type === 'MATCHED') {
        expect(match2.params).toEqual({ slug: 'my-first-post' });
      }
    });

    it('should match root optional parameter', () => {
      const router = new Router();
      router.get('/:locale?', () => HttpResponse.text('locale'));

      const matchRoot = router.match('GET', '/');
      expect(matchRoot.type).toBe('MATCHED');
      if (matchRoot.type === 'MATCHED') {
        expect(matchRoot.params).toEqual({});
      }

      const matchFr = router.match('GET', '/fr');
      expect(matchFr.type).toBe('MATCHED');
      if (matchFr.type === 'MATCHED') {
        expect(matchFr.params).toEqual({ locale: 'fr' });
      }
    });

    it('should throw InvalidRoutePatternError if optional parameter is not trailing', () => {
      const router = new Router();
      expect(() => {
        router.get('/users/:id?/posts', () => HttpResponse.text('err'));
      }).toThrow(InvalidRoutePatternError);
    });
  });

  describe('Parameter Constraints', () => {
    it('should enforce built-in number constraint', () => {
      const router = new Router();
      router.get('/users/:id<number>', () => HttpResponse.text('user-id'));

      const matchValid = router.match('GET', '/users/12345');
      expect(matchValid.type).toBe('MATCHED');
      if (matchValid.type === 'MATCHED') {
        expect(matchValid.params).toEqual({ id: '12345' });
      }

      const matchInvalid = router.match('GET', '/users/abc');
      expect(matchInvalid.type).toBe('NOT_FOUND');
    });

    it('should enforce built-in uuid constraint', () => {
      const router = new Router();
      router.get('/orders/:id<uuid>', () => HttpResponse.text('order'));

      const matchValid = router.match('GET', '/orders/123e4567-e89b-12d3-a456-426614174000');
      expect(matchValid.type).toBe('MATCHED');

      const matchInvalid = router.match('GET', '/orders/not-a-uuid');
      expect(matchInvalid.type).toBe('NOT_FOUND');
    });

    it('should enforce built-in slug constraint', () => {
      const router = new Router();
      router.get('/posts/:slug<slug>', () => HttpResponse.text('post'));

      expect(router.match('GET', '/posts/my-cool-post-123').type).toBe('MATCHED');
      expect(router.match('GET', '/posts/My_Post!').type).toBe('NOT_FOUND');
    });

    it('should enforce built-in alpha and alphanumeric constraints', () => {
      const router = new Router();
      router.get('/lang/:code<alpha>', () => HttpResponse.text('alpha'));
      router.get('/sku/:id<alphanumeric>', () => HttpResponse.text('alphanumeric'));

      expect(router.match('GET', '/lang/en').type).toBe('MATCHED');
      expect(router.match('GET', '/lang/en1').type).toBe('NOT_FOUND');

      expect(router.match('GET', '/sku/AB12CD').type).toBe('MATCHED');
      expect(router.match('GET', '/sku/AB-12').type).toBe('NOT_FOUND');
    });

    it('should enforce custom RegExp constraint defined in route options', () => {
      const router = new Router();
      router.get('/files/:ext', () => HttpResponse.text('file'), {
        constraints: {
          ext: /^(jpg|png|webp)$/,
        },
      });

      expect(router.match('GET', '/files/png').type).toBe('MATCHED');
      expect(router.match('GET', '/files/gif').type).toBe('NOT_FOUND');
    });

    it('should enforce custom function constraint validator', () => {
      const router = new Router();
      router.get('/years/:year', () => HttpResponse.text('year'), {
        constraints: {
          year: (val: string) => {
            const num = parseInt(val, 10);
            return !isNaN(num) && num >= 2000 && num <= 2030;
          },
        },
      });

      expect(router.match('GET', '/years/2026').type).toBe('MATCHED');
      expect(router.match('GET', '/years/1999').type).toBe('NOT_FOUND');
      expect(router.match('GET', '/years/2035').type).toBe('NOT_FOUND');
    });
  });

  describe('Wildcards', () => {
    it('should match single-segment and multi-segment wildcards', () => {
      const router = new Router();
      router.get('/static/*filepath', () => HttpResponse.text('static'));

      const match1 = router.match('GET', '/static/css/main.css');
      expect(match1.type).toBe('MATCHED');
      if (match1.type === 'MATCHED') {
        expect(match1.params).toEqual({ filepath: 'css/main.css' });
      }

      const match2 = router.match('GET', '/static/favicon.ico');
      expect(match2.type).toBe('MATCHED');
      if (match2.type === 'MATCHED') {
        expect(match2.params).toEqual({ filepath: 'favicon.ico' });
      }
    });

    it('should match empty wildcard at the end', () => {
      const router = new Router();
      router.get('/downloads/*path', () => HttpResponse.text('downloads'));

      const match = router.match('GET', '/downloads');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.params).toEqual({ path: '' });
      }
    });

    it('should throw InvalidRoutePatternError if wildcard is not at the end', () => {
      const router = new Router();
      expect(() => {
        router.get('/static/*filepath/info', () => HttpResponse.text('err'));
      }).toThrow(InvalidRoutePatternError);
    });
  });

  describe('Deterministic Route Priority', () => {
    it('should resolve in exact order: Static > Constrained Param > Generic Param > Wildcard', () => {
      const router = new Router();

      // Register in reverse order of precedence to prove registration order does not dictate match order
      router.get('/items/*rest', () => HttpResponse.text('wildcard'));
      router.get('/items/:id', () => HttpResponse.text('generic-param'));
      router.get('/items/:id<number>', () => HttpResponse.text('constrained-param'));
      router.get('/items/special', () => HttpResponse.text('static'));

      // 1. Static match
      const staticMatch = router.match('GET', '/items/special');
      expect(staticMatch.type).toBe('MATCHED');
      if (staticMatch.type === 'MATCHED') {
        expect(staticMatch.route.path).toBe('/items/special');
      }

      // 2. Constrained param match
      const constrainedMatch = router.match('GET', '/items/42');
      expect(constrainedMatch.type).toBe('MATCHED');
      if (constrainedMatch.type === 'MATCHED') {
        expect(constrainedMatch.route.path).toBe('/items/:id<number>');
        expect(constrainedMatch.params).toEqual({ id: '42' });
      }

      // 3. Generic param match
      const genericMatch = router.match('GET', '/items/banana');
      expect(genericMatch.type).toBe('MATCHED');
      if (genericMatch.type === 'MATCHED') {
        expect(genericMatch.route.path).toBe('/items/:id');
        expect(genericMatch.params).toEqual({ id: 'banana' });
      }

      // 4. Wildcard match
      const wildcardMatch = router.match('GET', '/items/a/b/c');
      expect(wildcardMatch.type).toBe('MATCHED');
      if (wildcardMatch.type === 'MATCHED') {
        expect(wildcardMatch.route.path).toBe('/items/*rest');
        expect(wildcardMatch.params).toEqual({ rest: 'a/b/c' });
      }
    });
  });

  describe('HTTP Methods and RFC 7231 Automatic HEAD Fallback', () => {
    it('should support all standard HTTP methods', () => {
      const router = new Router();
      const dummy: RouteHandler = () => HttpResponse.text('ok');

      router.get('/test', dummy);
      router.post('/test', dummy);
      router.put('/test', dummy);
      router.patch('/test', dummy);
      router.delete('/test', dummy);
      router.options('/test', dummy);

      expect(router.match('GET', '/test').type).toBe('MATCHED');
      expect(router.match('POST', '/test').type).toBe('MATCHED');
      expect(router.match('PUT', '/test').type).toBe('MATCHED');
      expect(router.match('PATCH', '/test').type).toBe('MATCHED');
      expect(router.match('DELETE', '/test').type).toBe('MATCHED');
      expect(router.match('OPTIONS', '/test').type).toBe('MATCHED');
    });

    it('should automatically fall back to GET handler for HEAD request when no HEAD route is registered', () => {
      const router = new Router();
      const getHandler: RouteHandler = () => HttpResponse.text('get-data');
      router.get('/data', getHandler);

      const match = router.match('HEAD', '/data');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.handler).toBe(getHandler);
        expect(match.isHeadFallback).toBe(true);
      }
    });

    it('should use explicit HEAD handler instead of fallback when HEAD is registered', () => {
      const router = new Router();
      const getHandler: RouteHandler = () => HttpResponse.text('get');
      const headHandler: RouteHandler = () => HttpResponse.text('head');

      router.get('/data', getHandler);
      router.head('/data', headHandler);

      const match = router.match('HEAD', '/data');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.handler).toBe(headHandler);
        expect(match.isHeadFallback).toBeUndefined();
      }
    });
  });

  describe('404 vs 405 Distinctions', () => {
    it('should return NOT_FOUND when path does not exist', () => {
      const router = new Router();
      router.get('/hello', () => HttpResponse.text('hello'));

      const res = router.match('GET', '/unknown');
      expect(res.type).toBe('NOT_FOUND');
    });

    it('should return METHOD_NOT_ALLOWED with allowed methods when path exists for other methods', () => {
      const router = new Router();
      router.post('/submit', () => HttpResponse.text('submitted'));

      const res = router.match('GET', '/submit');
      expect(res.type).toBe('METHOD_NOT_ALLOWED');
      if (res.type === 'METHOD_NOT_ALLOWED') {
        expect(res.allowedMethods).toEqual(['POST']);
      }
    });

    it('should include HEAD in allowedMethods if GET is registered on path', () => {
      const router = new Router();
      router.get('/info', () => HttpResponse.text('info'));

      const res = router.match('DELETE', '/info');
      expect(res.type).toBe('METHOD_NOT_ALLOWED');
      if (res.type === 'METHOD_NOT_ALLOWED') {
        expect(res.allowedMethods).toContain('GET');
        expect(res.allowedMethods).toContain('HEAD');
      }
    });
  });

  describe('Route Groups', () => {
    it('should support prefixing and nesting in route groups', () => {
      const router = new Router();

      router.group('/api', (api) => {
        api.group('/v1', (v1) => {
          v1.get('/users', () => HttpResponse.text('v1 users'));
        });
        api.get('/health', () => HttpResponse.text('api health'));
      });

      expect(router.match('GET', '/api/v1/users').type).toBe('MATCHED');
      expect(router.match('GET', '/api/health').type).toBe('MATCHED');
    });

    it('should inherit and merge metadata across group hierarchies', () => {
      const router = new Router();

      router.group({ prefix: '/admin', metadata: { auth: true, role: 'admin' } }, (admin) => {
        admin.get('/dashboard', () => HttpResponse.text('dashboard'), {
          metadata: { permission: 'view_dashboard' },
        });
      });

      const match = router.match('GET', '/admin/dashboard');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.metadata).toEqual({
          auth: true,
          role: 'admin',
          permission: 'view_dashboard',
        });
      }
    });

    it('should inherit and merge middleware arrays across group hierarchies', () => {
      const router = new Router();
      const mw1 = () => {};
      const mw2 = () => {};
      const mw3 = () => {};

      router.group({ prefix: '/api', middleware: [mw1] }, (api) => {
        api.group({ prefix: '/v1', middleware: [mw2] }, (v1) => {
          v1.get('/users', () => HttpResponse.text('users'), {
            middleware: [mw3],
          });
        });
      });

      const match = router.match('GET', '/api/v1/users');
      expect(match.type).toBe('MATCHED');
      if (match.type === 'MATCHED') {
        expect(match.route.middleware).toEqual([mw1, mw2, mw3]);
      }
    });
  });

  describe('Named Routes and URL Generation', () => {
    it('should generate URL for static and parameterized routes', () => {
      const router = new Router();
      router.get('/users/:id', () => HttpResponse.text('user'), { name: 'users.show' });

      const url = router.url('users.show', { id: 42 });
      expect(url).toBe('/users/42');
    });

    it('should throw InvalidRoutePatternError when required param is missing', () => {
      const router = new Router();
      router.get('/users/:id', () => HttpResponse.text('user'), { name: 'users.show' });

      expect(() => {
        router.url('users.show', {});
      }).toThrow(InvalidRoutePatternError);
    });

    it('should generate URL omitting optional parameter when not provided', () => {
      const router = new Router();
      router.get('/articles/:slug?', () => HttpResponse.text('article'), {
        name: 'articles.index',
      });

      expect(router.url('articles.index')).toBe('/articles');
      expect(router.url('articles.index', { slug: 'hello-world' })).toBe('/articles/hello-world');
    });

    it('should append extra params as query string', () => {
      const router = new Router();
      router.get('/search', () => HttpResponse.text('search'), { name: 'search' });

      const url = router.url('search', { q: 'typescript', page: 2 });
      expect(url).toBe('/search?q=typescript&page=2');
    });

    it('should throw DuplicateRouteNameError when registering duplicate name', () => {
      const router = new Router();
      router.get('/a', () => HttpResponse.text('a'), { name: 'test' });
      expect(() => {
        router.get('/b', () => HttpResponse.text('b'), { name: 'test' });
      }).toThrow(DuplicateRouteNameError);
    });

    it('should throw RouteNotFoundError when generating URL for unknown name', () => {
      const router = new Router();
      expect(() => {
        router.url('nonexistent');
      }).toThrow(RouteNotFoundError);
    });
  });

  describe('Compilation and Locking', () => {
    it('should lock router and prevent new route registration', () => {
      const router = new Router();
      router.get('/first', () => HttpResponse.text('first'));
      router.compile();

      expect(router.isLocked).toBe(true);
      expect(() => {
        router.get('/second', () => HttpResponse.text('second'));
      }).toThrow(RouterLockedError);
    });

    it('should allow idempotent calls to compile', () => {
      const router = new Router();
      router.compile();
      expect(() => router.compile()).not.toThrow();
    });
  });

  describe('router.handle(ctx) Request Dispatch', () => {
    it('should dispatch matching request to handler and set request.params', async () => {
      const router = new Router();
      router.get('/users/:id', (ctx) => {
        return HttpResponse.json({ userId: ctx.request.params['id'] });
      });

      const ctx = createMockContext('GET', 'http://localhost:3000/users/456');
      const response = await router.handle(ctx);

      expect(response.statusCode).toBe(HttpStatus.OK);
      expect(JSON.parse(response.body as string)).toEqual({ userId: '456' });
    });

    it('should return 404 response on unmatched path', async () => {
      const router = new Router();
      const ctx = createMockContext('GET', 'http://localhost:3000/nonexistent');
      const response = await router.handle(ctx);

      expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
      const data = JSON.parse(response.body as string);
      expect(data.error.code).toBe('ERR_HTTP_NOT_FOUND');
    });

    it('should return 405 response with Allow header on method mismatch', async () => {
      const router = new Router();
      router.post('/submit', () => HttpResponse.text('saved'));

      const ctx = createMockContext('GET', 'http://localhost:3000/submit');
      const response = await router.handle(ctx);

      expect(response.statusCode).toBe(HttpStatus.METHOD_NOT_ALLOWED);
      expect(response.headers.get('allow')).toBe('POST');
      const data = JSON.parse(response.body as string);
      expect(data.error.code).toBe('ERR_HTTP_METHOD_NOT_ALLOWED');
    });

    it('should discard response body for HEAD requests matching GET fallback', async () => {
      const router = new Router();
      router.get('/ping', () => HttpResponse.text('pong'));

      const ctx = createMockContext('HEAD', 'http://localhost:3000/ping');
      const response = await router.handle(ctx);

      expect(response.statusCode).toBe(HttpStatus.OK);
      expect(response.body).toBeNull();
    });
  });
});
