import { describe, it, expect } from 'vitest';
import { createApp, HttpRequest } from './index.js';

describe('app.openapi', () => {
  it('leaves admin routes out (any path) and escapes the title', async () => {
    const app = createApp();
    app.get('/ping', () => ({ ok: true }));
    app.admin({ path: '/backoffice', resources: [], media: {} });
    app.openapi({ title: '<script>x</script>' });

    const spec = JSON.parse(
      String(
        (await app.handle(new HttpRequest({ method: 'GET', url: 'http://l/openapi.json' }))).body
      )
    );
    expect(Object.keys(spec.paths)).toEqual(['/ping']);
    const docs = String(
      (await app.handle(new HttpRequest({ method: 'GET', url: 'http://l/docs' }))).body
    );
    expect(docs).not.toContain('<script>x</script>');
  });
});
