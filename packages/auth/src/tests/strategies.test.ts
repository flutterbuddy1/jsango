import { describe, it, expect } from 'vitest';
import { HttpRequest, RequestContext } from '@jsango/http';
import {
  BearerTokenAuthenticationStrategy,
  JwtTokenVerifier,
} from '../public/authentication/bearer.js';
import {
  ApiKeyAuthenticationStrategy,
  type IApiKeyVerifier,
} from '../public/authentication/api-key.js';
import {
  SessionAuthenticationStrategy,
  MemorySessionStore,
} from '../public/authentication/session.js';
import { AuthenticationManager } from '../public/authentication/manager.js';
import { JwtService } from '../public/authentication/jwt.js';
import { ServiceAccountIdentity } from '../public/identity.js';
import { CryptoUtils } from '../internal/crypto-utils.js';

describe('Authentication Strategies & Manager', () => {
  const secret = 'auth-strategy-test-secret-at-least-32-chars';
  const jwt = new JwtService(secret);
  const jwtVerifier = new JwtTokenVerifier({ jwt });
  const bearerStrategy = new BearerTokenAuthenticationStrategy({ verifier: jwtVerifier });

  describe('BearerTokenAuthenticationStrategy', () => {
    it('authenticates valid bearer token', async () => {
      const token = await jwt.sign({ sub: 'user-token', roles: ['admin'] });
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: { authorization: `Bearer ${token}` },
      });
      const ctx = new RequestContext({ request: req });

      const result = await bearerStrategy.authenticate(req, ctx);
      expect(result.status).toBe('authenticated');
      expect(result.identity.id).toBe('user-token');
      expect(result.identity.roles).toContain('admin');
    });

    it('returns unauthenticated when Authorization header is absent', async () => {
      const req = new HttpRequest({ method: 'GET', url: 'http://localhost/' });
      const ctx = new RequestContext({ request: req });

      const result = await bearerStrategy.authenticate(req, ctx);
      expect(result.status).toBe('unauthenticated');
    });

    it('returns unauthenticated when Authorization header is not Bearer', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      const ctx = new RequestContext({ request: req });

      const result = await bearerStrategy.authenticate(req, ctx);
      expect(result.status).toBe('unauthenticated');
    });

    it('returns malformed_credentials when Bearer header is empty or malformed', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: { authorization: 'Bearer   ' },
      });
      const ctx = new RequestContext({ request: req });

      const result = await bearerStrategy.authenticate(req, ctx);
      expect(result.status).toBe('malformed_credentials');
    });

    it('returns expired_credentials for expired token', async () => {
      const expiredToken = await jwt.sign({ sub: 'u-1' }, { expiresInSeconds: -60 });
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const ctx = new RequestContext({ request: req });

      const result = await bearerStrategy.authenticate(req, ctx);
      expect(result.status).toBe('expired_credentials');
    });
  });

  describe('ApiKeyAuthenticationStrategy', () => {
    const rawKey = 'test-api-key-secret-999';
    const hashedKey = CryptoUtils.sha256(rawKey);

    const keyVerifier: IApiKeyVerifier = {
      async verifyApiKey(hash: string) {
        if (hash === hashedKey) {
          return new ServiceAccountIdentity({
            id: 'sa-payment-service',
            roles: ['service'],
            permissions: ['payments.*'],
          });
        }
        return undefined;
      },
    };

    const apiKeyStrategy = new ApiKeyAuthenticationStrategy({ verifier: keyVerifier });

    it('authenticates via x-api-key header using SHA-256 hash lookup', async () => {
      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost/payments',
        headers: { 'x-api-key': rawKey },
      });
      const ctx = new RequestContext({ request: req });

      const result = await apiKeyStrategy.authenticate(req, ctx);
      expect(result.status).toBe('authenticated');
      expect(result.identity.id).toBe('sa-payment-service');
      expect(result.identity.hasPermission('payments.charge')).toBe(true);
    });

    it('authenticates via Authorization: ApiKey header', async () => {
      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost/payments',
        headers: { authorization: `ApiKey ${rawKey}` },
      });
      const ctx = new RequestContext({ request: req });

      const result = await apiKeyStrategy.authenticate(req, ctx);
      expect(result.status).toBe('authenticated');
      expect(result.identity.id).toBe('sa-payment-service');
    });

    it('returns invalid_credentials for wrong api key', async () => {
      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost/payments',
        headers: { 'x-api-key': 'wrong-key-value' },
      });
      const ctx = new RequestContext({ request: req });

      const result = await apiKeyStrategy.authenticate(req, ctx);
      expect(result.status).toBe('invalid_credentials');
    });
  });

  describe('AuthenticationManager (Chaining & Ordering)', () => {
    const sessionStore = new MemorySessionStore(60000);
    const sessionStrategy = new SessionAuthenticationStrategy({ store: sessionStore });

    const keyVerifier: IApiKeyVerifier = {
      async verifyApiKey(hash) {
        if (hash === CryptoUtils.sha256('secret-api-key')) {
          return new ServiceAccountIdentity({ id: 'sa-cron' });
        }
        return undefined;
      },
    };
    const apiKeyStrategy = new ApiKeyAuthenticationStrategy({ verifier: keyVerifier });

    const manager = new AuthenticationManager({
      strategies: [sessionStrategy, bearerStrategy, apiKeyStrategy],
      failOnError: true,
    });

    it('falls through from session to bearer when session cookie is absent', async () => {
      const token = await jwt.sign({ sub: 'user-via-bearer' });
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: { authorization: `Bearer ${token}` },
      });
      const ctx = new RequestContext({ request: req });

      const result = await manager.authenticate(req, ctx);
      expect(result.status).toBe('authenticated');
      expect(result.identity.id).toBe('user-via-bearer');
      expect(result.strategy).toBe('bearer');
    });

    it('prioritizes session strategy when session cookie is present and valid', async () => {
      const session = await sessionStore.create({ identityId: 'user-via-session' });
      const token = await jwt.sign({ sub: 'user-via-bearer' });

      // Request contains both Session cookie and Bearer token
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: {
          cookie: `session_id=${session.id}`,
          authorization: `Bearer ${token}`,
        },
      });
      const ctx = new RequestContext({ request: req });

      const result = await manager.authenticate(req, ctx);
      expect(result.status).toBe('authenticated');
      // Deterministic priority: session is first
      expect(result.identity.id).toBe('user-via-session');
      expect(result.strategy).toBe('session');
    });

    it('fails fast on invalid credentials without falling through to weaker strategies', async () => {
      // Bearer header contains an invalid token, but API key is also present
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost/',
        headers: {
          authorization: 'Bearer totally-invalid-token',
          'x-api-key': 'secret-api-key',
        },
      });
      const ctx = new RequestContext({ request: req });

      const result = await manager.authenticate(req, ctx);
      // With failOnError: true, the manager halts on the invalid Bearer credential
      expect(result.status).toBe('invalid_credentials');
      expect(result.strategy).toBe('bearer');
    });
  });
});
