import { describe, it, expect } from 'vitest';
import { HttpResponse } from './public/response.js';
import { HttpStatus } from './public/status.js';
import { ResponseAlreadyCommittedError } from './public/errors.js';

describe('HttpResponse', () => {
  it('should create JSON response with correct defaults', () => {
    const res = HttpResponse.json({ success: true, count: 5 });
    expect(res.statusCode).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.body).toBe(JSON.stringify({ success: true, count: 5 }));
  });

  it('should create text and HTML responses', () => {
    const textRes = HttpResponse.text('Hello World');
    expect(textRes.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(textRes.body).toBe('Hello World');

    const htmlRes = HttpResponse.html('<h1>Hello</h1>');
    expect(htmlRes.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(htmlRes.body).toBe('<h1>Hello</h1>');
  });

  it('should create redirect response', () => {
    const res = HttpResponse.redirect('https://example.com/login', HttpStatus.MOVED_PERMANENTLY);
    expect(res.statusCode).toBe(301);
    expect(res.headers.get('location')).toBe('https://example.com/login');
  });

  it('should manage set-cookie and delete-cookie', () => {
    const res = new HttpResponse();
    res.setCookie('token', 'xyz', { secure: true, httpOnly: true });
    res.deleteCookie('oldSession');

    expect(res.cookies).toHaveLength(2);
    expect(res.cookies[0]).toContain('token=xyz');
    expect(res.cookies[0]).toContain('Secure');
    expect(res.cookies[1]).toContain('oldSession=');
    expect(res.cookies[1]).toContain('Max-Age=0');
  });

  it('should enforce lifecycle states and prevent mutation after committed', () => {
    const res = HttpResponse.json({ ok: true });
    expect(res.state).toBe('created');

    res.markCommitted();
    expect(res.state).toBe('committed');

    expect(() => {
      res.statusCode = 404;
    }).toThrow(ResponseAlreadyCommittedError);

    expect(() => {
      res.body = 'new body';
    }).toThrow(ResponseAlreadyCommittedError);

    expect(() => {
      res.setCookie('another', 'val');
    }).toThrow(ResponseAlreadyCommittedError);
  });
});
