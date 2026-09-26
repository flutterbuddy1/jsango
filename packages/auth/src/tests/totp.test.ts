import { describe, it, expect } from 'vitest';
import { TotpService, base32Encode, base32Decode } from '../public/authentication/totp.js';

describe('TotpService', () => {
  const service = new TotpService();

  it('correctly encodes and decodes Base32', () => {
    const input = Buffer.from('Hello, JSango Auth!');
    const encoded = base32Encode(input);
    const decoded = base32Decode(encoded);
    expect(decoded.toString()).toBe('Hello, JSango Auth!');
  });

  it('generates a secret and otpauth URI', () => {
    const res = service.generateSecret({
      issuer: 'JSango Enterprise',
      accountName: 'admin@jsango.dev',
    });

    expect(res.secret).toBeDefined();
    expect(res.secret.length).toBeGreaterThan(16);
    expect(res.uri).toContain('otpauth://totp/JSango%20Enterprise:admin%40jsango.dev');
    expect(res.uri).toContain(`secret=${res.secret}`);
    expect(res.qrCodeUrl).toBeDefined();
  });

  it('generates and verifies 6-digit TOTP tokens accurately', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const now = Date.now();
    const token = service.generateToken(secret, now);

    expect(token).toHaveLength(6);
    expect(/^\d{6}$/.test(token)).toBe(true);

    const isValid = service.verifyToken(token, secret);
    expect(isValid).toBe(true);

    const isInvalid = service.verifyToken('000000', secret);
    expect(isInvalid).toBe(false);
  });

  it('generates and consumes emergency backup codes', () => {
    const codes = service.generateBackupCodes(6);
    expect(codes).toHaveLength(6);
    expect(codes[0]).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);

    const codeToTest = codes[0]!;
    const { valid, remainingCodes } = service.verifyAndConsumeBackupCode(codeToTest, codes);
    expect(valid).toBe(true);
    expect(remainingCodes).toHaveLength(5);
    expect(remainingCodes.includes(codeToTest)).toBe(false);

    // Second consumption of same code fails
    const secondAttempt = service.verifyAndConsumeBackupCode(codeToTest, remainingCodes);
    expect(secondAttempt.valid).toBe(false);
    expect(secondAttempt.remainingCodes).toHaveLength(5);
  });
});
