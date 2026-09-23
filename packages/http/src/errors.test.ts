import { describe, it, expect } from 'vitest';
import {
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  InternalServerError,
  formatHttpErrorResponse,
} from './public/errors.js';

describe('HTTP Errors', () => {
  it('should instantiate HTTP error subclasses with correct codes and status', () => {
    const notFound = new NotFoundError('User not found');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe('ERR_HTTP_NOT_FOUND');
    expect(notFound.message).toBe('User not found');

    const tooLarge = new PayloadTooLargeError();
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.code).toBe('ERR_HTTP_PAYLOAD_TOO_LARGE');
  });

  it('should format errors safely for production', () => {
    const internalErr = new InternalServerError({
      message: 'Sensitive database host leaked: 192.168.1.10',
      metadata: { query: 'SELECT * FROM secrets' },
    });

    const formattedProd = formatHttpErrorResponse(internalErr, true);
    expect(formattedProd.statusCode).toBe(500);
    expect(formattedProd.body.error.code).toBe('ERR_HTTP_INTERNAL_SERVER_ERROR');
    expect(formattedProd.body.error.message).toBe('An internal error occurred.');
    expect(formattedProd.body.error.metadata).toBeUndefined();
  });

  it('should format errors with full diagnostics in non-production mode', () => {
    const internalErr = new InternalServerError({
      message: 'Detailed error trace',
      metadata: { table: 'users' },
    });

    const formattedDev = formatHttpErrorResponse(internalErr, false);
    expect(formattedDev.statusCode).toBe(500);
    expect(formattedDev.body.error.message).toBe('Detailed error trace');
    expect(formattedDev.body.error.metadata).toEqual({ table: 'users' });
  });

  it('should format 4xx client errors without masking in production', () => {
    const clientErr = new BadRequestError({
      message: 'Invalid email address provided',
      metadata: { field: 'email' },
    });

    const formatted = formatHttpErrorResponse(clientErr, true);
    expect(formatted.statusCode).toBe(400);
    expect(formatted.body.error.message).toBe('Invalid email address provided');
    expect(formatted.body.error.metadata).toEqual({ field: 'email' });
  });

  it('should safely format generic native errors', () => {
    const rawError = new Error('Unexpected crash');
    const formatted = formatHttpErrorResponse(rawError, true);

    expect(formatted.statusCode).toBe(500);
    expect(formatted.body.error.code).toBe('ERR_INTERNAL_ERROR');
    expect(formatted.body.error.message).toBe('An internal error occurred.');
  });
});
