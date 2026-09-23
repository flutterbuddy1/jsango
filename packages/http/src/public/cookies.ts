import { DjangoJsError } from '@django-js/core';

export interface CookieOptions {
  readonly maxAge?: number;
  readonly expires?: Date;
  readonly domain?: string;
  readonly path?: string;
  readonly secure?: boolean;
  readonly httpOnly?: boolean;
  readonly sameSite?: 'Strict' | 'Lax' | 'None';
  readonly partitioned?: boolean;
}

export interface SetCookieEntry {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

export function parseCookies(
  cookieHeader: string | null | undefined
): Readonly<Record<string, string>> {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return Object.freeze({});
  }

  const result: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let val = trimmed.slice(equalIndex + 1).trim();

    // Strip optional surrounding quotes
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }

    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }

  return Object.freeze(result);
}

const FORBIDDEN_COOKIE_NAME_CHARS = new Set('()<>@,;: \\"/[]?={}'.split(''));

function isInvalidCookieName(name: string): boolean {
  if (!name) return true;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code <= 32 || code === 127 || FORBIDDEN_COOKIE_NAME_CHARS.has(name[i]!)) {
      return true;
    }
  }
  return false;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (isInvalidCookieName(name)) {
    throw new DjangoJsError({
      code: 'ERR_INVALID_COOKIE_NAME',
      message: `Invalid cookie name: "${name}"`,
      statusCode: 400,
    });
  }

  // Prevent CRLF injection in cookie values
  if (/[\r\n]/.test(value)) {
    throw new DjangoJsError({
      code: 'ERR_COOKIE_INJECTION',
      message: 'Cookie value must not contain CRLF characters.',
      statusCode: 400,
    });
  }

  const encodedValue = encodeURIComponent(value);
  let cookieString = `${name}=${encodedValue}`;

  if (typeof options.maxAge === 'number') {
    if (options.maxAge < 0) {
      cookieString += '; Max-Age=0';
    } else {
      cookieString += `; Max-Age=${Math.floor(options.maxAge)}`;
    }
  }

  if (options.expires instanceof Date) {
    cookieString += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.domain) {
    if (/[\r\n;]/.test(options.domain)) {
      throw new DjangoJsError({
        code: 'ERR_COOKIE_INJECTION',
        message: 'Cookie domain contains forbidden characters.',
        statusCode: 400,
      });
    }
    cookieString += `; Domain=${options.domain}`;
  }

  const path = options.path ?? '/';
  if (/[\r\n;]/.test(path)) {
    throw new DjangoJsError({
      code: 'ERR_COOKIE_INJECTION',
      message: 'Cookie path contains forbidden characters.',
      statusCode: 400,
    });
  }
  cookieString += `; Path=${path}`;

  if (options.secure) {
    cookieString += '; Secure';
  }

  if (options.httpOnly ?? true) {
    // Secure by default: HttpOnly unless explicitly turned off
    cookieString += '; HttpOnly';
  }

  if (options.sameSite) {
    cookieString += `; SameSite=${options.sameSite}`;
  }

  if (options.partitioned) {
    cookieString += '; Partitioned';
  }

  return cookieString;
}
