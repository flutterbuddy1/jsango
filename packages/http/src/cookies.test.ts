import { describe, it, expect } from 'vitest';
import { parseCookies, serializeCookie } from './public/cookies.js';
import { DjangoJsError } from '@django-js/core';

describe('Cookies', () => {
  it('should parse simple and quoted cookie headers', () => {
    const header = 'sessionId=s12345; theme="dark"; user=alice';
    const parsed = parseCookies(header);

    expect(parsed['sessionId']).toBe('s12345');
    expect(parsed['theme']).toBe('dark');
    expect(parsed['user']).toBe('alice');
  });

  it('should return empty object for null or empty header', () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('should serialize cookie with standard security attributes', () => {
    const serialized = serializeCookie('session', 'secret123', {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api',
      maxAge: 3600,
    });

    expect(serialized).toContain('session=secret123');
    expect(serialized).toContain('HttpOnly');
    expect(serialized).toContain('Secure');
    expect(serialized).toContain('SameSite=Strict');
    expect(serialized).toContain('Path=/api');
    expect(serialized).toContain('Max-Age=3600');
  });

  it('should prevent CRLF injection in cookie values', () => {
    expect(() => {
      serializeCookie('auth', 'val\r\nSet-Cookie: evil=1');
    }).toThrow(DjangoJsError);
  });

  it('should reject invalid cookie names', () => {
    expect(() => {
      serializeCookie('bad=name', 'val');
    }).toThrow(DjangoJsError);
    expect(() => {
      serializeCookie('bad;name', 'val');
    }).toThrow(DjangoJsError);
  });
});
