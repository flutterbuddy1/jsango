import { AnonymousIdentity, UserIdentity } from '../identity.js';
import { TokenExpiredError } from '../errors.js';
export class JwtTokenVerifier {
    jwt;
    identityResolver;
    constructor(options) {
        this.jwt = options.jwt;
        this.identityResolver = options.identityResolver;
    }
    async verifyToken(token) {
        const payload = await this.jwt.verify(token);
        if (this.identityResolver) {
            return this.identityResolver(payload);
        }
        const sub = payload.sub ?? payload['id'] ?? 'anonymous';
        const roles = Array.isArray(payload['roles']) ? payload['roles'] : [];
        const permissions = Array.isArray(payload['permissions'])
            ? payload['permissions']
            : [];
        const tenantId = typeof payload['tenantId'] === 'string' ? payload['tenantId'] : undefined;
        return new UserIdentity({
            id: sub,
            roles,
            permissions,
            tenantId,
            metadata: payload,
        });
    }
}
export class BearerTokenAuthenticationStrategy {
    name = 'bearer';
    verifier;
    realm;
    constructor(options) {
        this.verifier = options.verifier;
        this.realm = options.realm ?? 'Application';
    }
    async authenticate(request, _context) {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return {
                status: 'unauthenticated',
                identity: new AnonymousIdentity(),
                strategy: this.name,
            };
        }
        const parts = authHeader.trim().split(/\s+/);
        const scheme = parts[0]?.toLowerCase();
        if (scheme !== 'bearer') {
            return {
                status: 'unauthenticated',
                identity: new AnonymousIdentity(),
                strategy: this.name,
            };
        }
        if (parts.length < 2 || !parts[1] || parts[1].trim().length === 0) {
            return {
                status: 'malformed_credentials',
                identity: new AnonymousIdentity(),
                strategy: this.name,
            };
        }
        const token = parts[1].trim();
        try {
            const identity = await this.verifier.verifyToken(token);
            if (!identity) {
                return {
                    status: 'invalid_credentials',
                    identity: new AnonymousIdentity(),
                    strategy: this.name,
                };
            }
            return {
                status: 'authenticated',
                identity,
                strategy: this.name,
            };
        }
        catch (err) {
            if (err instanceof TokenExpiredError) {
                return {
                    status: 'expired_credentials',
                    identity: new AnonymousIdentity(),
                    strategy: this.name,
                    error: err,
                };
            }
            return {
                status: 'invalid_credentials',
                identity: new AnonymousIdentity(),
                strategy: this.name,
                error: err instanceof Error ? err : new Error(String(err)),
            };
        }
    }
}
//# sourceMappingURL=bearer.js.map