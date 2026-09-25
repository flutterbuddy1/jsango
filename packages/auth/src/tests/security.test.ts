import { describe, it, expect } from 'vitest';
import {
  UserIdentity,
  AuthorizationManager,
  JwtService,
  timingSafeEqualString,
  BasePolicy,
  PolicyRegistry,
} from '../public/index.js';

describe('Security Invariants & Defenses', () => {
  describe('Timing Attack Mitigation', () => {
    it('compares strings in constant time safely without throwing on length mismatch', () => {
      expect(timingSafeEqualString('secret-token-12345', 'secret-token-12345')).toBe(true);
      expect(timingSafeEqualString('secret-token-12345', 'secret-token-1234X')).toBe(false);
      expect(timingSafeEqualString('short', 'longer-string-comparison')).toBe(false);
      expect(timingSafeEqualString('', '')).toBe(true);
      expect(timingSafeEqualString('', 'non-empty')).toBe(false);
    });
  });

  describe('Credential Leakage Prevention', () => {
    it('identity serialization toJSON never exposes credentials', () => {
      const identity = new UserIdentity({
        id: 'u-secure',
        roles: ['admin'],
        permissions: ['read', 'write'],
        metadata: {
          email: 'admin@example.com',
          // Even if someone put a token in metadata, identity itself has no password property
        },
      });

      const serialized = identity.toJSON();
      expect(serialized).not.toHaveProperty('password');
      expect(serialized).not.toHaveProperty('secret');
      expect(serialized.id).toBe('u-secure');
    });
  });

  describe('Fail-Closed Authorization', () => {
    const authManager = new AuthorizationManager();

    it('denies access when identity is undefined', async () => {
      const decision = await authManager.authorize(undefined, 'users.delete');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/Identity is missing/);
    });

    it('denies access when resource policy is missing', async () => {
      const user = new UserIdentity({ id: 'u-1' });
      const resource = { type: 'unregistered_document' };

      const decision = await authManager.authorize(user, 'read', resource);
      expect(decision.allowed).toBe(false);
    });

    it('denies access when policy throws unexpected error (fail-closed)', async () => {
      class CrashingPolicy extends BasePolicy {
        public readonly name = 'CrashingPolicy';
        public override can() {
          throw new Error('Database connection unexpectedly dropped inside policy');
        }
      }

      const policies = new PolicyRegistry();
      policies.registerFor('FailingResource', new CrashingPolicy());
      const manager = new AuthorizationManager({ policies });

      class FailingResource {
        public static readonly metadata = { name: 'FailingResource' };
      }

      const user = new UserIdentity({ id: 'u-1' });
      const decision = await manager.authorize(user, 'action', new FailingResource());

      // MUST FAIL CLOSED!
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/Policy evaluation error/);
    });
  });

  describe('JWT Algorithm Confusion & Tampering Defenses', () => {
    const secret = 'strong-jwt-secret-key-at-least-32-chars-long';
    const jwt = new JwtService(secret);

    it('rejects token when signature is altered', async () => {
      const token = await jwt.sign({ sub: 'user-legit' });
      const parts = token.split('.');
      const alteredSig = parts[2]?.slice(0, -4) + 'AAAA';
      const tampered = `${parts[0]}.${parts[1]}.${alteredSig}`;

      await expect(jwt.verify(tampered)).rejects.toThrow();
    });

    it('rejects token when algorithm header is none', async () => {
      const b64Header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url'
      );
      const b64Payload = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');
      const noneToken = `${b64Header}.${b64Payload}.`;

      await expect(jwt.verify(noneToken)).rejects.toThrow();
    });
  });
});
