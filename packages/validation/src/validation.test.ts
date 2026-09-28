import { describe, it, expect } from 'vitest';
import {
  string,
  number,
  boolean,
  date,
  email,
  array,
  schema,
  validate,
  type IValidator,
  type ValidationResult,
} from './index.js';
import { HttpRequest, HttpResponse, HttpStatus, RequestContext } from '@jsango/http';

describe('@jsango/validation', () => {
  it('should support typing custom validator contract', () => {
    interface RegisterPayload {
      email: string;
    }

    class MockEmailValidator implements IValidator<RegisterPayload> {
      validate(input: unknown): ValidationResult<RegisterPayload> {
        if (typeof input === 'object' && input !== null && 'email' in input) {
          const val = String((input as { email: unknown }).email);
          if (val.includes('@')) {
            return { success: true, data: { email: val } };
          }
        }
        return {
          success: false,
          errors: [{ field: 'email', message: 'Invalid email address' }],
        };
      }
    }

    const validator = new MockEmailValidator();
    const valid = validator.validate({ email: 'test@example.com' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.email).toBe('test@example.com');
    }

    const invalid = validator.validate({ email: 'not-an-email' });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.errors).toHaveLength(1);
    }
  });

  it('validates strings, numbers, booleans, dates, emails, and arrays', () => {
    const userSchema = schema({
      name: string().min(2).max(50),
      age: number().int().min(18).optional(),
      email: email(),
      isActive: boolean().default(true),
      tags: array(string()).min(1).optional(),
      createdAt: date().optional(),
    });

    const validResult = userSchema.validate({
      name: 'John Doe',
      age: 25,
      email: 'john@example.com',
      tags: ['typescript', 'backend'],
      createdAt: new Date().toISOString(),
    });

    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.name).toBe('John Doe');
      expect(validResult.data.isActive).toBe(true);
      expect(validResult.data.tags).toEqual(['typescript', 'backend']);
    }

    const invalidResult = userSchema.validate({
      name: 'J',
      age: 12,
      email: 'not-email',
      tags: [],
    });

    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.errors.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('validate() middleware rejects invalid request body with HTTP 400', async () => {
    const mw = validate({
      name: string().min(2),
      email: email(),
    });

    const req = new HttpRequest({
      method: 'POST',
      url: 'http://localhost/users',
      body: JSON.stringify({ name: 'A', email: 'invalid' }),
    });
    const ctx = new RequestContext({ request: req });

    let nextCalled = false;
    const res = await mw(ctx, async () => {
      nextCalled = true;
      return HttpResponse.json({ ok: true });
    });

    expect(nextCalled).toBe(false);
    expect(res).toBeInstanceOf(HttpResponse);
    const httpRes = res as HttpResponse;
    expect(httpRes.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('validate() middleware passes valid request body to next handler', async () => {
    const mw = validate({
      name: string().min(2),
      email: email(),
    });

    const req = new HttpRequest({
      method: 'POST',
      url: 'http://localhost/users',
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    });
    const ctx = new RequestContext({ request: req });

    let nextCalled = false;
    const res = await mw(ctx, async () => {
      nextCalled = true;
      return HttpResponse.json({ ok: true, validated: ctx.state.get('validatedBody') });
    });

    expect(nextCalled).toBe(true);
    expect((res as HttpResponse).status).toBe(HttpStatus.OK);
  });
});
