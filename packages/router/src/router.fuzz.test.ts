import { describe, it, expect } from 'vitest';
import { Router } from './index.js';
import { HttpResponse } from '@jsango/http';

describe('Router Fuzz and Edge-Case Tests', () => {
  it('should handle heavily duplicate and trailing slashes safely', () => {
    const router = new Router();
    router.get('/api/v1/users', () => HttpResponse.text('ok'));

    const variants = [
      '/api/v1/users',
      '/api/v1/users/',
      '//api//v1//users',
      '///api///v1///users///',
      '/api////v1////////users/',
    ];

    for (const path of variants) {
      const match = router.match('GET', path);
      expect(match.type).toBe('MATCHED');
    }
  });

  it('should handle malformed percent encoding without throwing', () => {
    const router = new Router();
    router.get('/search/:term', () => HttpResponse.text('ok'));

    const malformed = [
      '/search/%',
      '/search/%2',
      '/search/%ZZ',
      '/search/%E0%A4%A',
      '/search/%%20',
      '/search/%u0000',
      '/search/hello%20world%99',
    ];

    for (const path of malformed) {
      expect(() => {
        const match = router.match('GET', path);
        expect(match.type).toBe('MATCHED');
      }).not.toThrow();
    }
  });

  it('should support full Unicode, emojis, and non-ASCII paths', () => {
    const router = new Router();
    router.get('/users/日本語/:id', () => HttpResponse.text('ja'));
    router.get('/emoji/🚀/:rocket', () => HttpResponse.text('rocket'));

    const matchJa = router.match('GET', '/users/日本語/123');
    expect(matchJa.type).toBe('MATCHED');
    if (matchJa.type === 'MATCHED') {
      expect(matchJa.params).toEqual({ id: '123' });
    }

    const matchRocket = router.match('GET', '/emoji/🚀/falcon9');
    expect(matchRocket.type).toBe('MATCHED');
    if (matchRocket.type === 'MATCHED') {
      expect(matchRocket.params).toEqual({ rocket: 'falcon9' });
    }
  });

  it('should gracefully handle extremely deep nested routes (50+ segments)', () => {
    const router = new Router();
    const segments = Array.from({ length: 50 }, (_, i) => `seg${i}`);
    const deepPath = `/${segments.join('/')}`;

    router.get(deepPath, () => HttpResponse.text('deep'));

    const match = router.match('GET', deepPath);
    expect(match.type).toBe('MATCHED');

    const miss = router.match('GET', `${deepPath}/extra`);
    expect(miss.type).toBe('NOT_FOUND');
  });

  it('should handle very long parameter values (10,000+ characters)', () => {
    const router = new Router();
    router.get('/echo/:payload', () => HttpResponse.text('echo'));

    const hugePayload = 'a'.repeat(10000);
    const match = router.match('GET', `/echo/${hugePayload}`);

    expect(match.type).toBe('MATCHED');
    if (match.type === 'MATCHED') {
      expect(match.params['payload']?.length).toBe(10000);
    }
  });

  it('should not crash on randomized pseudo-fuzz inputs', () => {
    const router = new Router();
    router.get('/', () => HttpResponse.text('root'));
    router.get('/items/:id<number>', () => HttpResponse.text('number'));
    router.get('/items/:slug<slug>', () => HttpResponse.text('slug'));
    router.get('/files/*filepath', () => HttpResponse.text('file'));

    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_./%?&=#+ ';
    function randomString(len: number): string {
      let res = '';
      for (let i = 0; i < len; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
      }
      return res;
    }

    // 200 random queries
    for (let i = 0; i < 200; i++) {
      const path = '/' + randomString(Math.floor(Math.random() * 50));
      expect(() => {
        const result = router.match('GET', path);
        expect(result).toBeDefined();
        expect(typeof result.type).toBe('string');
      }).not.toThrow();
    }
  });
});
