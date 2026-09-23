import { describe, it, expect } from 'vitest';
import { DjangoJsError, NoopLogger } from './index.js';

describe('@django-js/core', () => {
  describe('DjangoJsError', () => {
    it('should instantiate error with code, message, and status', () => {
      const err = new DjangoJsError({
        code: 'ERR_NOT_FOUND',
        message: 'Resource was not found',
        statusCode: 404,
        metadata: { id: 123 },
      });

      expect(err.code).toBe('ERR_NOT_FOUND');
      expect(err.message).toBe('Resource was not found');
      expect(err.statusCode).toBe(404);
      expect(err.metadata).toEqual({ id: 123 });
    });

    it('should safely serialize 5xx error in production', () => {
      const err = new DjangoJsError({
        code: 'ERR_DB_CRASH',
        message: 'Database connection string leaked: secret_pwd',
        statusCode: 500,
        metadata: { host: 'internal.db' },
      });

      const safe = err.toSafeJSON(true);
      expect(safe.code).toBe('ERR_DB_CRASH');
      expect(safe.message).toBe('An internal error occurred.');
      expect(safe.metadata).toBeUndefined();
    });

    it('should serialize error with details in non-production mode', () => {
      const err = new DjangoJsError({
        code: 'ERR_DB_CRASH',
        message: 'Detailed error info',
        statusCode: 500,
        metadata: { detail: 'query failed' },
      });

      const safe = err.toSafeJSON(false);
      expect(safe.message).toBe('Detailed error info');
      expect(safe.metadata).toEqual({ detail: 'query failed' });
    });
  });

  describe('NoopLogger', () => {
    it('should implement ILogger interface without errors', () => {
      const logger = new NoopLogger();
      expect(() => {
        logger.debug('test');
        logger.info('test');
        logger.warn('test');
        logger.error('test');
        logger.child({ requestId: 'abc' });
      }).not.toThrow();
    });
  });
});
