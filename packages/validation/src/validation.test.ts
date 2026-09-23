import { describe, it, expect } from 'vitest';
import type { IValidator, ValidationResult } from './index.js';

describe('@django-js/validation', () => {
  it('should support typing mock validator contract', () => {
    interface RegisterPayload {
      email: string;
    }

    class MockEmailValidator implements IValidator<RegisterPayload> {
      validate(input: unknown): ValidationResult<RegisterPayload> {
        if (typeof input === 'object' && input !== null && 'email' in input) {
          const email = String((input as { email: unknown }).email);
          if (email.includes('@')) {
            return { success: true, data: { email } };
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
});
