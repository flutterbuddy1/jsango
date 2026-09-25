import { CryptoUtils } from '../../internal/crypto-utils.js';
import { UserIdentity } from '../identity.js';
import type {
  AuthenticationResult,
  CreateSessionData,
  IAuthenticationStrategy,
  ISessionStore,
  Session,
} from '../types.js';
import type { HttpRequest, RequestContext } from '@django-js/http';

export class MemorySessionStore implements ISessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly defaultTtlMs: number;

  public constructor(defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public async get(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }

    return session;
  }

  public async create(data: CreateSessionData): Promise<Session> {
    const id = CryptoUtils.generateSecureToken(32);
    const now = Date.now();
    const ttl = data.ttlMs ?? this.defaultTtlMs;

    const session: Session = {
      id,
      identityId: data.identityId,
      roles: Object.freeze([...(data.roles ?? [])]),
      tenantId: data.tenantId,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttl,
      data: Object.freeze({ ...(data.data ?? {}) }),
    };

    this.sessions.set(id, session);
    return session;
  }

  public async update(id: string, data: Partial<Session>): Promise<Session | undefined> {
    const existing = await this.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: Session = {
      ...existing,
      ...data,
      id: existing.id, // prevent ID overwrite
      identityId: existing.identityId,
      updatedAt: Date.now(),
      data: data.data ? Object.freeze({ ...existing.data, ...data.data }) : existing.data,
    };

    this.sessions.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  public async touch(id: string, ttlMs?: number): Promise<boolean> {
    const session = await this.get(id);
    if (!session) {
      return false;
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    const touched: Session = {
      ...session,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.sessions.set(id, touched);
    return true;
  }

  public clear(): void {
    this.sessions.clear();
  }
}

export interface SessionAuthStrategyOptions {
  readonly store: ISessionStore;
  readonly cookieName?: string | undefined;
}

export class SessionAuthenticationStrategy implements IAuthenticationStrategy {
  public readonly name = 'session';
  public readonly store: ISessionStore;
  public readonly cookieName: string;

  public constructor(options: SessionAuthStrategyOptions) {
    this.store = options.store;
    this.cookieName = options.cookieName ?? 'session_id';
  }

  public async authenticate(
    request: HttpRequest,
    _context: RequestContext
  ): Promise<AuthenticationResult> {
    const sessionId = request.cookies[this.cookieName];
    if (!sessionId) {
      return {
        status: 'unauthenticated',
        identity: new (await import('../identity.js')).AnonymousIdentity(),
        strategy: this.name,
      };
    }

    const session = await this.store.get(sessionId);
    if (!session) {
      return {
        status: 'invalid_credentials',
        identity: new (await import('../identity.js')).AnonymousIdentity(),
        strategy: this.name,
      };
    }

    if (Date.now() > session.expiresAt) {
      await this.store.delete(sessionId);
      return {
        status: 'expired_credentials',
        identity: new (await import('../identity.js')).AnonymousIdentity(),
        strategy: this.name,
      };
    }

    const identity = new UserIdentity({
      id: session.identityId,
      roles: session.roles,
      tenantId: session.tenantId,
      metadata: { sessionId: session.id, ...session.data },
    });

    return {
      status: 'authenticated',
      identity,
      strategy: this.name,
      metadata: { sessionId: session.id },
    };
  }

  /**
   * Rotates a session identifier to prevent session fixation attacks.
   */
  public async rotate(oldSessionId: string): Promise<Session | undefined> {
    const oldSession = await this.store.get(oldSessionId);
    if (!oldSession) {
      return undefined;
    }

    // Create new session with identical data
    const newSession = await this.store.create({
      identityId: oldSession.identityId,
      roles: oldSession.roles,
      tenantId: oldSession.tenantId,
      data: { ...oldSession.data },
      ttlMs: oldSession.expiresAt - Date.now(),
    });

    // Invalidate old session
    await this.store.delete(oldSessionId);

    return newSession;
  }
}
