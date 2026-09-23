import { describe, it, expect } from 'vitest';
import { HttpBody } from './public/body.js';
import {
  BadRequestError,
  PayloadAlreadyConsumedError,
  PayloadTooLargeError,
} from './public/errors.js';

describe('HttpBody', () => {
  it('should parse JSON payload', async () => {
    const raw = JSON.stringify({ name: 'django-js', version: '0.0.1' });
    const body = new HttpBody(raw);

    const parsed = await body.json<{ name: string; version: string }>();
    expect(parsed.name).toBe('django-js');
    expect(parsed.version).toBe('0.0.1');
    expect(body.isConsumed).toBe(true);
  });

  it('should prevent multiple body consumption', async () => {
    const body = new HttpBody('hello world');
    await body.text();
    expect(body.isConsumed).toBe(true);

    await expect(body.text()).rejects.toThrow(PayloadAlreadyConsumedError);
    await expect(body.json()).rejects.toThrow(PayloadAlreadyConsumedError);
    await expect(body.bytes()).rejects.toThrow(PayloadAlreadyConsumedError);
  });

  it('should throw BadRequestError on invalid JSON', async () => {
    const body = new HttpBody('not-a-json-string');
    await expect(body.json()).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError on empty JSON body', async () => {
    const body = new HttpBody('   ');
    await expect(body.json()).rejects.toThrow(BadRequestError);
  });

  it('should enforce configurable maxBodySize', async () => {
    const largeText = 'A'.repeat(50);
    // Limit to 20 bytes
    const body = new HttpBody(largeText, 20);

    await expect(body.text()).rejects.toThrow(PayloadTooLargeError);
  });

  it('should parse form urlencoded data', async () => {
    const body = new HttpBody('username=alice&role=admin&tag=ts&tag=js');
    const form = await body.formData();

    expect(form['username']).toBe('alice');
    expect(form['role']).toBe('admin');
    expect(form['tag']).toEqual(['ts', 'js']);
  });

  it('should return empty bytes for null source', async () => {
    const body = new HttpBody(null);
    const bytes = await body.bytes();
    expect(bytes.byteLength).toBe(0);
  });
});
