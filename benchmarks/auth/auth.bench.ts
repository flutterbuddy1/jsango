import { describe, bench } from 'vitest';
import {
  ScryptPasswordHasher,
  JwtService,
  JwtTokenVerifier,
  BearerTokenAuthenticationStrategy,
  MemorySessionStore,
  SessionAuthenticationStrategy,
  PermissionRegistry,
  RoleRegistry,
  BasePolicy,
  PolicyRegistry,
  AuthorizationManager,
  UserIdentity,
  SystemIdentity,
  type Identity,
} from '../../packages/auth/src/index.js';
import { HttpRequest, RequestContext } from '../../packages/http/src/index.js';

// Setup Hasher with reasonable work factor
const testHasher = new ScryptPasswordHasher({ cost: 2048, blockSize: 8, parallelization: 1 });
const knownPassword = 'SecureUserPassword2026!';
let knownHash = '';

// Setup JWT
const jwt = new JwtService('benchmark-jwt-secret-key-32-chars-long');
let validToken = '';

// Setup Session
const sessionStore = new MemorySessionStore(60000);
const sessionStrategy = new SessionAuthenticationStrategy({ store: sessionStore });
let sessionId = '';

// Setup Bearer Strategy
const bearerStrategy = new BearerTokenAuthenticationStrategy({
  verifier: new JwtTokenVerifier({ jwt }),
});

// Setup Authorization
const permissions = new PermissionRegistry();
permissions.register({ name: 'articles.view' });
permissions.register({ name: 'articles.edit' });
permissions.register({ name: 'articles.delete' });

const roles = new RoleRegistry();
roles.register({
  name: 'editor',
  permissions: ['articles.view', 'articles.edit'],
});

interface Article {
  id: string;
  authorId: string;
  isPublished: boolean;
}

class ArticlePolicy extends BasePolicy<Article> {
  public readonly name = 'ArticlePolicy';
  public view(_identity: Identity, article?: Article): boolean {
    return Boolean(article?.isPublished);
  }
  public edit(identity: Identity, article?: Article): boolean {
    return article?.authorId === identity.id;
  }
}

const policies = new PolicyRegistry();
policies.registerFor('Article', new ArticlePolicy());

const authz = new AuthorizationManager({ permissions, roles, policies });
const regularUser = new UserIdentity({
  id: 'user-bench',
  roles: ['editor'],
  permissions: ['articles.view'],
});
const superuser = new SystemIdentity();

const testArticle: Article = {
  id: 'art-1',
  authorId: 'user-bench',
  isPublished: true,
};

describe('Auth Benchmarks', () => {
  // Pre-seed async items
  bench(
    'setup',
    async () => {
      if (!knownHash) {
        knownHash = await testHasher.hash(knownPassword);
      }
      if (!validToken) {
        validToken = await jwt.sign({ sub: 'user-bench', roles: ['editor'] });
      }
      if (!sessionId) {
        const session = await sessionStore.create({ identityId: 'user-bench', roles: ['editor'] });
        sessionId = session.id;
      }
    },
    { iterations: 1 }
  );

  // 1. Password Hashing & Verification
  describe('Password Hashing (Memory-hard Scrypt N=2048)', () => {
    bench('password verify (valid)', async () => {
      await testHasher.verify(knownPassword, knownHash);
    });
  });

  // 2. JWT Signing & Verification
  describe('Token Operations (HS256)', () => {
    bench('JWT sign payload', async () => {
      await jwt.sign({ sub: 'bench-user', role: 'admin' }, { expiresInSeconds: 300 });
    });

    bench('JWT verify token', async () => {
      await jwt.verify(validToken);
    });
  });

  // 3. Strategy Authentication
  describe('Authentication Strategies', () => {
    const bearerReq = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/api',
      headers: { authorization: `Bearer ${validToken}` },
    });
    const bearerCtx = new RequestContext({ request: bearerReq });

    bench('BearerTokenStrategy.authenticate', async () => {
      await bearerStrategy.authenticate(bearerReq, bearerCtx);
    });

    const sessionReq = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/api',
      headers: { cookie: `session_id=${sessionId}` },
    });
    const sessionCtx = new RequestContext({ request: sessionReq });

    bench('SessionStrategy.authenticate (MemoryStore)', async () => {
      await sessionStrategy.authenticate(sessionReq, sessionCtx);
    });
  });

  // 4. Authorization Performance
  describe('Authorization Decisions', () => {
    bench('PermissionRegistry.matches (exact & wildcard)', () => {
      PermissionRegistry.matches(['articles.*'], 'articles.edit');
    });

    bench('AuthorizationManager.can (direct permission)', async () => {
      await authz.can(regularUser, 'articles.view');
    });

    bench('AuthorizationManager.can (role mapped permission)', async () => {
      await authz.can(regularUser, 'articles.edit');
    });

    bench('AuthorizationManager.can (object-level policy)', async () => {
      await authz.can(regularUser, 'edit', testArticle);
    });

    bench('AuthorizationManager.authorize (superuser bypass audit)', async () => {
      await authz.authorize(superuser, 'any.action');
    });

    bench('AuthorizationManager.authorizeMany (10 resources bulk)', async () => {
      const articles = [
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
        testArticle,
      ];
      await authz.authorizeMany(regularUser, 'view', articles);
    });
  });
});
