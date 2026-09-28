import { AnonymousIdentity } from '../identity.js';
export class AuthenticationManager {
    strategies = [];
    failOnError;
    constructor(options = {}) {
        if (options.strategies) {
            this.strategies.push(...options.strategies);
        }
        this.failOnError = options.failOnError ?? true;
    }
    registerStrategy(strategy) {
        if (!this.strategies.some((s) => s.name === strategy.name)) {
            this.strategies.push(strategy);
        }
        return this;
    }
    getStrategies() {
        return Object.freeze([...this.strategies]);
    }
    async authenticate(request, context) {
        if (this.strategies.length === 0) {
            return {
                status: 'unauthenticated',
                identity: new AnonymousIdentity(),
            };
        }
        let lastFailure;
        for (const strategy of this.strategies) {
            try {
                const result = await strategy.authenticate(request, context);
                if (result.status === 'authenticated') {
                    return result;
                }
                if (result.status !== 'unauthenticated') {
                    // A strategy found credentials intended for it but they failed (invalid, expired, malformed)
                    lastFailure = result;
                    if (this.failOnError) {
                        return result;
                    }
                }
            }
            catch (error) {
                const failureResult = {
                    status: 'invalid_credentials',
                    identity: new AnonymousIdentity(),
                    strategy: strategy.name,
                    error: error instanceof Error ? error : new Error(String(error)),
                };
                if (this.failOnError) {
                    return failureResult;
                }
                lastFailure = failureResult;
            }
        }
        if (lastFailure) {
            return lastFailure;
        }
        return {
            status: 'unauthenticated',
            identity: new AnonymousIdentity(),
        };
    }
}
//# sourceMappingURL=manager.js.map