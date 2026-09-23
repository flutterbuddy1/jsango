import { describe, it, expect } from 'vitest';
import { RequestContext } from './public/context.js';
import { HttpRequest } from './public/request.js';
import { HttpResponse } from './public/response.js';

describe('RequestContext', () => {
  it('should initialize context with request and response instances', () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/test',
    });

    const ctx = new RequestContext({ request: req });
    expect(ctx.request).toBe(req);
    expect(ctx.response).toBeInstanceOf(HttpResponse);
    expect(ctx.requestId).toBe(req.requestId);
    expect(ctx.signal).toBe(req.signal);
  });

  it('should allow storing and retrieving custom state', () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/dashboard',
    });

    const ctx = new RequestContext({ request: req });
    ctx.state.set('userId', 'user_abc');
    ctx.state.set('role', 'admin');

    expect(ctx.state.get('userId')).toBe('user_abc');
    expect(ctx.state.get('role')).toBe('admin');
  });
});
