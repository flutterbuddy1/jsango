import { describe, it, expect } from 'vitest';
import {
  PermissionRegistry,
  RoleRegistry,
  BasePolicy,
  PolicyRegistry,
  AuthorizationManager,
  AuthDecision,
  andPolicy,
  orPolicy,
  notPolicy,
  ForbiddenError,
  UserIdentity,
  AnonymousIdentity,
  SystemIdentity,
  type Identity,
} from '../public/index.js';

interface Article {
  id: string;
  authorId: string;
  isPublished: boolean;
}

class ArticlePolicy extends BasePolicy<Article> {
  public readonly name = 'ArticlePolicy';

  public view(_identity: Identity, article?: Article): boolean {
    if (!article) return true;
    return article.isPublished;
  }

  public update(identity: Identity, article?: Article): boolean {
    if (!article) return false;
    return article.authorId === identity.id;
  }

  public delete(identity: Identity, article?: Article): boolean {
    if (!article) return false;
    return identity.hasRole('editor') || article.authorId === identity.id;
  }
}

describe('Authorization Subsystem', () => {
  describe('PermissionRegistry', () => {
    it('registers and matches exact and wildcard permissions', () => {
      const reg = new PermissionRegistry();
      reg.register({ name: 'users.read', description: 'Read users' });
      reg.register({ name: 'users.write', description: 'Write users' });

      expect(reg.has('users.read')).toBe(true);
      expect(reg.get('users.read')?.description).toBe('Read users');
      expect(reg.getAll()).toHaveLength(2);

      // Matches
      expect(PermissionRegistry.matches(['users.read'], 'users.read')).toBe(true);
      expect(PermissionRegistry.matches(['users.*'], 'users.read')).toBe(true);
      expect(PermissionRegistry.matches(['users.*'], 'users.write')).toBe(true);
      expect(PermissionRegistry.matches(['*'], 'any.arbitrary.permission')).toBe(true);
      expect(PermissionRegistry.matches(['posts.*'], 'users.read')).toBe(false);
    });

    it('rejects duplicate permission registration', () => {
      const reg = new PermissionRegistry();
      reg.register({ name: 'users.read' });
      expect(() => reg.register({ name: 'users.read' })).toThrow(/already registered/);
    });
  });

  describe('RoleRegistry', () => {
    it('registers roles and resolves aggregate permissions', () => {
      const roles = new RoleRegistry();
      roles.register({
        name: 'reader',
        permissions: ['articles.read', 'comments.read'],
      });
      roles.register({
        name: 'writer',
        permissions: ['articles.create', 'articles.update'],
      });

      const aggregate = roles.getPermissionsForRoles(['reader', 'writer']);
      expect(aggregate).toContain('articles.read');
      expect(aggregate).toContain('comments.read');
      expect(aggregate).toContain('articles.create');
      expect(aggregate).toContain('articles.update');
      expect(aggregate).toHaveLength(4);
    });
  });

  describe('PolicyRegistry & BasePolicy', () => {
    it('evaluates object-level permissions based on resource state', async () => {
      const articlePolicy = new ArticlePolicy();
      const userAlice = new UserIdentity({ id: 'user-alice' });
      const userBob = new UserIdentity({ id: 'user-bob' });

      const article: Article = {
        id: 'art-1',
        authorId: 'user-alice',
        isPublished: true,
      };

      // Alice is author -> can update
      expect(await articlePolicy.can(userAlice, 'update', article)).toBe(true);

      // Bob is not author -> cannot update
      expect(await articlePolicy.can(userBob, 'update', article)).toBe(false);

      // Both can view published article
      expect(await articlePolicy.can(userBob, 'view', article)).toBe(true);

      // Unpublished article cannot be viewed by Bob
      const draft: Article = { ...article, isPublished: false };
      expect(await articlePolicy.can(userBob, 'view', draft)).toBe(false);
    });

    it('resolves policy via constructor or ModelMetadata identity', () => {
      const policies = new PolicyRegistry();
      const articlePolicy = new ArticlePolicy();

      // Mock ORM Model class with ModelMetadata name 'Article'
      class ArticleModel {
        public static readonly metadata = { name: 'Article' };
      }

      policies.registerFor('Article', articlePolicy);

      const resolvedByString = policies.resolvePolicy('Article');
      expect(resolvedByString?.name).toBe('ArticlePolicy');

      const modelInstance = new ArticleModel();
      const resolvedByInstance = policies.resolvePolicy(modelInstance);
      expect(resolvedByInstance?.name).toBe('ArticlePolicy');
    });
  });

  describe('Composite Policies (andPolicy, orPolicy, notPolicy)', () => {
    const isOwner: BasePolicy<Article> = {
      name: 'isOwner',
      can: (identity, _action, resource) => resource?.authorId === identity.id,
    };

    const isPublished: BasePolicy<Article> = {
      name: 'isPublished',
      can: (_identity, _action, resource) => Boolean(resource?.isPublished),
    };

    it('evaluates andPolicy requiring both conditions', async () => {
      const combined = andPolicy(isOwner, isPublished);
      const userAlice = new UserIdentity({ id: 'alice' });

      const myPublishedArticle: Article = { id: '1', authorId: 'alice', isPublished: true };
      const myDraftArticle: Article = { id: '2', authorId: 'alice', isPublished: false };

      const resAllowed = await combined.can(userAlice, 'view', myPublishedArticle);
      expect((resAllowed as AuthDecision).allowed).toBe(true);

      const resDenied = await combined.can(userAlice, 'view', myDraftArticle);
      expect((resDenied as AuthDecision).allowed).toBe(false);
    });

    it('evaluates orPolicy allowing either condition', async () => {
      const combined = orPolicy(isOwner, isPublished);
      const userBob = new UserIdentity({ id: 'bob' });

      // Published article not owned by Bob -> allowed via isPublished
      const publishedOther: Article = { id: '1', authorId: 'alice', isPublished: true };
      const resAllowed = await combined.can(userBob, 'view', publishedOther);
      expect((resAllowed as AuthDecision).allowed).toBe(true);

      // Draft article not owned by Bob -> denied
      const draftOther: Article = { id: '2', authorId: 'alice', isPublished: false };
      const resDenied = await combined.can(userBob, 'view', draftOther);
      expect((resDenied as AuthDecision).allowed).toBe(false);
    });

    it('evaluates notPolicy inverting condition', async () => {
      const notOwner = notPolicy(isOwner);
      const userAlice = new UserIdentity({ id: 'alice' });
      const userBob = new UserIdentity({ id: 'bob' });
      const aliceArticle: Article = { id: '1', authorId: 'alice', isPublished: true };

      expect(((await notOwner.can(userBob, 'edit', aliceArticle)) as AuthDecision).allowed).toBe(
        true
      );
      expect(((await notOwner.can(userAlice, 'edit', aliceArticle)) as AuthDecision).allowed).toBe(
        false
      );
    });
  });

  describe('AuthorizationManager', () => {
    const roles = new RoleRegistry();
    roles.register({ name: 'moderator', permissions: ['comments.delete', 'articles.flag'] });

    const policies = new PolicyRegistry();
    const articlePolicy = new ArticlePolicy();
    policies.registerFor('Article', articlePolicy);

    const auth = new AuthorizationManager({ roles, policies });

    it('centralizes and audits explicit superuser bypass', async () => {
      const superuser = new SystemIdentity();
      expect(superuser.isSuperuser).toBe(true);

      const decision = await auth.authorize(superuser, 'any.action.whatsoever');
      expect(decision.allowed).toBe(true);
      expect(decision.policy).toBe('SuperuserPolicy');
      expect(decision.metadata?.isSuperuser).toBe(true);
    });

    it('grants permission via user direct permissions', async () => {
      const user = new UserIdentity({
        id: 'u-1',
        permissions: ['billing.view'],
      });

      const decision = await auth.authorize(user, 'billing.view');
      expect(decision.allowed).toBe(true);
      expect(decision.policy).toBe('PermissionRegistry');
    });

    it('grants permission via user roles', async () => {
      const user = new UserIdentity({
        id: 'u-2',
        roles: ['moderator'],
      });

      const decision = await auth.authorize(user, 'comments.delete');
      expect(decision.allowed).toBe(true);
      expect(decision.policy).toBe('RoleRegistry');
    });

    it('fails closed when identity is missing or unauthenticated', async () => {
      const anonymous = new AnonymousIdentity();
      const decisionAnon = await auth.authorize(anonymous, 'secret.read');
      expect(decisionAnon.allowed).toBe(false);

      const decisionNull = await auth.authorize(undefined, 'secret.read');
      expect(decisionNull.allowed).toBe(false);
    });

    it('fails closed when resource has no matching policy', async () => {
      const user = new UserIdentity({ id: 'u-3' });
      const unmanagedResource = { id: 'res-99' };

      const decision = await auth.authorize(user, 'delete', unmanagedResource);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/No authorization policy found/);
    });

    it('enforces authorization with ForbiddenError on failure', async () => {
      const user = new UserIdentity({ id: 'u-4' });
      await expect(auth.enforce(user, 'classified.read')).rejects.toThrow(ForbiddenError);
    });

    it('supports bulk authorization (authorizeMany)', async () => {
      const userAlice = new UserIdentity({ id: 'alice' });

      class ArticleItem {
        public static readonly metadata = { name: 'Article' };
        public id: string;
        public authorId: string;
        public isPublished: boolean;
        constructor(id: string, authorId: string, isPublished: boolean) {
          this.id = id;
          this.authorId = authorId;
          this.isPublished = isPublished;
        }
      }

      const articles = [
        new ArticleItem('1', 'alice', true),
        new ArticleItem('2', 'bob', true),
        new ArticleItem('3', 'alice', false),
      ];

      const decisions = await auth.authorizeMany(userAlice, 'update', articles);
      expect(decisions).toHaveLength(3);
      expect(decisions[0]?.allowed).toBe(true); // Alice's article
      expect(decisions[1]?.allowed).toBe(false); // Bob's article
      expect(decisions[2]?.allowed).toBe(true); // Alice's article
    });
  });
});
