import type { AuthenticationResult, CreateSessionData, IAuthenticationStrategy, ISessionStore, Session } from '../types.js';
import type { HttpRequest, RequestContext } from '@jsango/http';
export declare class MemorySessionStore implements ISessionStore {
    private readonly sessions;
    private readonly defaultTtlMs;
    constructor(defaultTtlMs?: number);
    get(id: string): Promise<Session | undefined>;
    create(data: CreateSessionData): Promise<Session>;
    update(id: string, data: Partial<Session>): Promise<Session | undefined>;
    delete(id: string): Promise<boolean>;
    touch(id: string, ttlMs?: number): Promise<boolean>;
    listByIdentity(identityId: string): Promise<Session[]>;
    deleteByIdentity(identityId: string, excludeSessionId?: string): Promise<number>;
    clear(): void;
}
export interface SessionAuthStrategyOptions {
    readonly store: ISessionStore;
    readonly cookieName?: string | undefined;
}
export declare class SessionAuthenticationStrategy implements IAuthenticationStrategy {
    readonly name = "session";
    readonly store: ISessionStore;
    readonly cookieName: string;
    constructor(options: SessionAuthStrategyOptions);
    authenticate(request: HttpRequest, _context: RequestContext): Promise<AuthenticationResult>;
    /**
     * Rotates a session identifier to prevent session fixation attacks.
     */
    rotate(oldSessionId: string): Promise<Session | undefined>;
}
//# sourceMappingURL=session.d.ts.map