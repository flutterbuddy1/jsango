import { describe, it, expect } from 'vitest';
import { JwtService, MemoryTokenRevocationStore } from '../public/authentication/jwt.js';
import { InvalidCredentialsError, TokenExpiredError } from '../public/errors.js';
import { Base64Url } from '../internal/base64url.js';

describe('JwtService', () => {
  const secret = 'super-secret-key-that-is-at-least-32-chars-long';
  const jwt = new JwtService(secret);

  it('signs and verifies valid tokens with HS256', async () => {
    const token = await jwt.sign({ sub: 'user-123', role: 'admin' }, { expiresInSeconds: 3600 });
    const payload = await jwt.verify(token);

    expect(payload.sub).toBe('user-123');
    expect(payload['role']).toBe('admin');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('signs and verifies with HS384 and HS512', async () => {
    const token384 = await jwt.sign({ sub: 'u-384' }, { algorithm: 'HS384', expiresInSeconds: 60 });
    const payload384 = await jwt.verify(token384);
    expect(payload384.sub).toBe('u-384');

    const token512 = await jwt.sign({ sub: 'u-512' }, { algorithm: 'HS512', expiresInSeconds: 60 });
    const payload512 = await jwt.verify(token512);
    expect(payload512.sub).toBe('u-512');
  });

  it('rejects expired tokens with TokenExpiredError', async () => {
    const expiredToken = await jwt.sign({ sub: 'u-expired' }, { expiresInSeconds: -10 });
    await expect(jwt.verify(expiredToken)).rejects.toThrow(TokenExpiredError);
  });

  it('rejects tokens not yet active with InvalidCredentialsError', async () => {
    const notYetActive = await jwt.sign({ sub: 'u-future' }, { notBeforeSeconds: 3600 });
    await expect(jwt.verify(notYetActive)).rejects.toThrow(InvalidCredentialsError);
  });

  it('validates issuer and audience', async () => {
    const token = await jwt.sign(
      { sub: 'u-claims' },
      { issuer: 'my-app', audience: 'api-service', expiresInSeconds: 60 }
    );

    // Valid matches
    const valid = await jwt.verify(token, { issuer: 'my-app', audience: 'api-service' });
    expect(valid.sub).toBe('u-claims');

    // Mismatched issuer
    await expect(jwt.verify(token, { issuer: 'wrong-issuer' })).rejects.toThrow(
      InvalidCredentialsError
    );

    // Mismatched audience
    await expect(jwt.verify(token, { audience: 'wrong-audience' })).rejects.toThrow(
      InvalidCredentialsError
    );
  });

  it('rejects tampered tokens', async () => {
    const token = await jwt.sign({ sub: 'legitimate-user' });
    const parts = token.split('.');

    // Tamper with payload
    const tamperedPayload = Base64Url.encode(JSON.stringify({ sub: 'attacker-admin' }));
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(jwt.verify(tamperedToken)).rejects.toThrow(InvalidCredentialsError);
  });

  it('defends against algorithm confusion attack (rejects "none" algorithm)', async () => {
    const fakeHeader = Base64Url.encode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const fakePayload = Base64Url.encode(JSON.stringify({ sub: 'attacker-admin' }));
    const exploitToken = `${fakeHeader}.${fakePayload}.`;

    await expect(jwt.verify(exploitToken)).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects algorithm outside allowed algorithms list', async () => {
    const token = await jwt.sign({ sub: 'user-1' }, { algorithm: 'HS256' });
    await expect(jwt.verify(token, { allowedAlgorithms: ['HS384'] })).rejects.toThrow(
      InvalidCredentialsError
    );
  });

  it('supports token revocation via revocation store', async () => {
    const revocationStore = new MemoryTokenRevocationStore();
    const revocableJwt = new JwtService(secret, { revocationStore });

    const token = await revocableJwt.sign(
      { sub: 'user-revocable' },
      { jwtId: 'token-uuid-1', expiresInSeconds: 3600 }
    );

    // Before revocation: valid
    const payload = await revocableJwt.verify(token);
    expect(payload.sub).toBe('user-revocable');

    // Revoke token
    await revocationStore.revoke('token-uuid-1', Math.floor(Date.now() / 1000) + 3600);

    // After revocation: rejected
    await expect(revocableJwt.verify(token)).rejects.toThrow(InvalidCredentialsError);
  });
});
