import { describe, it, expect } from 'vitest';
import type { IHttpRequest, IHttpResponse } from './index.js';

describe('@django-js/http', () => {
  it('should support typing mock HTTP request and response', async () => {
    const mockRequest: IHttpRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/users?page=1',
      path: '/api/users',
      headers: { 'content-type': 'application/json' },
      query: { page: '1' },
      params: {},
      body: async () => ({ ok: true }),
    };

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true },
    };

    expect(mockRequest.method).toBe('GET');
    expect(mockRequest.path).toBe('/api/users');
    expect(mockResponse.statusCode).toBe(200);
    const body = await mockRequest.body<{ ok: boolean }>();
    expect(body.ok).toBe(true);
  });
});
