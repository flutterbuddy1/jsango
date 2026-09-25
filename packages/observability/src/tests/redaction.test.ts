import { describe, it, expect } from 'vitest';
import { Redactor } from '../public/redaction.js';

describe('Redactor', () => {
  const redactor = new Redactor();

  it('redacts common sensitive key names', () => {
    const input = {
      user: 'alice',
      password: 'secretPassword123',
      apiKey: 'api-secret-key',
      token: 'jwt.token.val',
      authorization: 'Bearer token',
      secret: 'topSecret',
      salt: 'cryptoSalt',
      ssn: '123-45-6789',
      cvv: '123',
      nested: {
        privateKey: 'private-rsa-key',
        safeKey: 'hello',
      },
    };

    const output = redactor.redact(input);

    expect(output.user).toBe('alice');
    expect(output.password).toBe('[REDACTED]');
    expect(output.apiKey).toBe('[REDACTED]');
    expect(output.token).toBe('[REDACTED]');
    expect(output.authorization).toBe('[REDACTED]');
    expect(output.secret).toBe('[REDACTED]');
    expect(output.salt).toBe('[REDACTED]');
    expect(output.ssn).toBe('[REDACTED]');
    expect(output.cvv).toBe('[REDACTED]');
    expect(output.nested.privateKey).toBe('[REDACTED]');
    expect(output.nested.safeKey).toBe('hello');
  });

  it('does not mutate the original input object', () => {
    const original = { password: 'secretPassword123', user: 'bob' };
    const copy = redactor.redact(original);

    expect(original.password).toBe('secretPassword123');
    expect(copy.password).toBe('[REDACTED]');
  });

  it('handles circular references without infinite loops', () => {
    const obj: Record<string, unknown> = { name: 'circular' };
    obj['self'] = obj;

    const output = redactor.redact(obj) as Record<string, unknown>;
    expect(output['name']).toBe('circular');
    expect(output['self']).toBe('[Circular]');
  });

  it('redacts sensitive headers', () => {
    const headers = {
      'content-type': 'application/json',
      authorization: 'Bearer my-token',
      cookie: 'session_id=123',
      'x-custom-header': 'value',
    };

    const clean = redactor.redactHeaders(headers);

    expect(clean['content-type']).toBe('application/json');
    expect(clean['authorization']).toBe('[REDACTED]');
    expect(clean['cookie']).toBe('[REDACTED]');
    expect(clean['x-custom-header']).toBe('value');
  });
});
