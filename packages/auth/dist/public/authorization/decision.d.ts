import type { AuthorizationDecision } from '../types.js';
export declare class AuthDecision implements AuthorizationDecision {
    readonly allowed: boolean;
    readonly reason?: string | undefined;
    readonly policy?: string | undefined;
    readonly metadata?: Readonly<Record<string, unknown>> | undefined;
    constructor(allowed: boolean, reason?: string | undefined, policy?: string | undefined, metadata?: Readonly<Record<string, unknown>> | undefined);
    static allow(reason?: string, policy?: string, metadata?: Readonly<Record<string, unknown>>): AuthDecision;
    static deny(reason?: string, policy?: string, metadata?: Readonly<Record<string, unknown>>): AuthDecision;
}
//# sourceMappingURL=decision.d.ts.map