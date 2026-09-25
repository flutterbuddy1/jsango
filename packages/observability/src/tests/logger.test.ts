import { describe, it, expect } from 'vitest';
import { StructuredLogger } from '../public/logger.js';
import type { StructuredLogEntry } from '../public/types.js';

describe('StructuredLogger', () => {
  it('logs messages at or above minLevel and suppresses below minLevel', () => {
    const entries: StructuredLogEntry[] = [];
    const logger = new StructuredLogger({
      minLevel: 'info',
      sink: (e) => entries.push(e),
    });

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.level)).toEqual(['info', 'warn', 'error']);
    expect(entries[0]!.message).toBe('Info message');
  });

  it('binds context with child() / withContext()', () => {
    const entries: StructuredLogEntry[] = [];
    const baseLogger = new StructuredLogger({
      sink: (e) => entries.push(e),
    });

    const childLogger = baseLogger.child({
      module: 'auth',
      requestId: 'req-123',
    });

    childLogger.info('User authenticated', { userId: 'u42' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.module).toBe('auth');
    expect(entries[0]!.requestId).toBe('req-123');
    expect(entries[0]!.context?.['userId']).toBe('u42');
  });

  it('redacts sensitive fields in context automatically', () => {
    const entries: StructuredLogEntry[] = [];
    const logger = new StructuredLogger({
      sink: (e) => entries.push(e),
    });

    logger.info('Account created', {
      username: 'alice',
      password: 'plain-secret-password',
      token: 'jwt-access-token',
      nested: {
        apiKey: 'secret-key-123',
        publicField: 'safe',
      },
    });

    expect(entries).toHaveLength(1);
    const ctx = entries[0]!.context as Record<string, unknown>;
    expect(ctx['username']).toBe('alice');
    expect(ctx['password']).toBe('[REDACTED]');
    expect(ctx['token']).toBe('[REDACTED]');
    const nested = ctx['nested'] as Record<string, unknown>;
    expect(nested['apiKey']).toBe('[REDACTED]');
    expect(nested['publicField']).toBe('safe');
  });

  it('sanitizes newline and carriage return characters from message (log injection prevention)', () => {
    const entries: StructuredLogEntry[] = [];
    const logger = new StructuredLogger({
      sink: (e) => entries.push(e),
    });

    logger.info('Malicious input:\r\n[ERROR] Fake log line injection');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.message).not.toContain('\r');
    expect(entries[0]!.message).not.toContain('\n');
  });

  it('captures structured error information when error is passed in context', () => {
    const entries: StructuredLogEntry[] = [];
    const logger = new StructuredLogger({
      sink: (e) => entries.push(e),
    });

    const err = Object.assign(new Error('Connection timed out'), { code: 'ERR_TIMEOUT' });
    logger.error('Database query failed', { error: err });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.error).toBeDefined();
    expect(entries[0]!.error?.message).toBe('Connection timed out');
    expect(entries[0]!.error?.code).toBe('ERR_TIMEOUT');
    expect(entries[0]!.error?.stack).toBeDefined();
  });
});
