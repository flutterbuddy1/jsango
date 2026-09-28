import { CryptoUtils } from '../../internal/crypto-utils.js';
import { AnonymousIdentity } from '../identity.js';
export class ApiKeyAuthenticationStrategy {
    name = 'api_key';
    verifier;
    headerName;
    constructor(options) {
        this.verifier = options.verifier;
        this.headerName = (options.headerName ?? 'x-api-key').toLowerCase();
    }
    async authenticate(request, _context) {
        let rawKey = request.headers.get(this.headerName);
        // Also check Authorization: ApiKey <key>
        if (!rawKey) {
            const authHeader = request.headers.get('authorization');
            if (authHeader) {
                const match = /^ApiKey\s+(.+)$/i.exec(authHeader);
                if (match && match[1]) {
                    rawKey = match[1].trim();
                }
            }
        }
        if (!rawKey) {
            return {
                status: 'unauthenticated',
                identity: new AnonymousIdentity(),
                strategy: this.name,
            };
        }
        const hashedKey = CryptoUtils.sha256(rawKey);
        try {
            const identity = await this.verifier.verifyApiKey(hashedKey, rawKey);
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
                metadata: { hashedKeyPrefix: hashedKey.slice(0, 8) },
            };
        }
        catch (err) {
            return {
                status: 'invalid_credentials',
                identity: new AnonymousIdentity(),
                strategy: this.name,
                error: err instanceof Error ? err : new Error(String(err)),
            };
        }
    }
}
//# sourceMappingURL=api-key.js.map