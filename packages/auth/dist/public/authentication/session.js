import { CryptoUtils } from '../../internal/crypto-utils.js';
import { UserIdentity } from '../identity.js';
export class MemorySessionStore {
    sessions = new Map();
    defaultTtlMs;
    constructor(defaultTtlMs = 24 * 60 * 60 * 1000) {
        this.defaultTtlMs = defaultTtlMs;
    }
    async get(id) {
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
    async create(data) {
        const id = CryptoUtils.generateSecureToken(32);
        const now = Date.now();
        const ttl = data.ttlMs ?? this.defaultTtlMs;
        const session = {
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
    async update(id, data) {
        const existing = await this.get(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
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
    async delete(id) {
        return this.sessions.delete(id);
    }
    async touch(id, ttlMs) {
        const session = await this.get(id);
        if (!session) {
            return false;
        }
        const ttl = ttlMs ?? this.defaultTtlMs;
        const touched = {
            ...session,
            updatedAt: Date.now(),
            expiresAt: Date.now() + ttl,
        };
        this.sessions.set(id, touched);
        return true;
    }
    async listByIdentity(identityId) {
        const now = Date.now();
        const result = [];
        for (const [id, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.sessions.delete(id);
                continue;
            }
            if (session.identityId === identityId) {
                result.push(session);
            }
        }
        return result;
    }
    async deleteByIdentity(identityId, excludeSessionId) {
        let deletedCount = 0;
        for (const [id, session] of this.sessions.entries()) {
            if (session.identityId === identityId && id !== excludeSessionId) {
                this.sessions.delete(id);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    clear() {
        this.sessions.clear();
    }
}
export class SessionAuthenticationStrategy {
    name = 'session';
    store;
    cookieName;
    constructor(options) {
        this.store = options.store;
        this.cookieName = options.cookieName ?? 'session_id';
    }
    async authenticate(request, _context) {
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
    async rotate(oldSessionId) {
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
//# sourceMappingURL=session.js.map