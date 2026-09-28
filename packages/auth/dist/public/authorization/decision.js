export class AuthDecision {
    allowed;
    reason;
    policy;
    metadata;
    constructor(allowed, reason, policy, metadata) {
        this.allowed = allowed;
        this.reason = reason;
        this.policy = policy;
        this.metadata = metadata ? Object.freeze({ ...metadata }) : undefined;
    }
    static allow(reason, policy, metadata) {
        return new AuthDecision(true, reason, policy, metadata);
    }
    static deny(reason = 'Access denied.', policy, metadata) {
        return new AuthDecision(false, reason, policy, metadata);
    }
}
//# sourceMappingURL=decision.js.map