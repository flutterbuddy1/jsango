import { CacheKeyError } from './errors.js';
// Regex matching ASCII control characters (0x00-0x1F, 0x7F) and spaces/newlines
// eslint-disable-next-line no-control-regex -- Intentional: validates cache keys don't contain control characters
const INVALID_KEY_CHARS = /[\x00-\x1F\x7F\s]/;
/**
 * Normalizes, validates, and builds safe namespaced cache keys.
 */
export class CacheKeyBuilder {
    application;
    environment;
    prefix;
    namespace;
    maxKeyLength;
    delimiter;
    constructor(options = {}) {
        this.application = options.application ? this.sanitizeSegment(options.application) : undefined;
        this.environment = options.environment ? this.sanitizeSegment(options.environment) : undefined;
        this.prefix = options.prefix ? this.sanitizeSegment(options.prefix) : undefined;
        this.namespace = options.namespace ? this.sanitizeSegment(options.namespace) : undefined;
        this.maxKeyLength = options.maxKeyLength ?? 250;
        this.delimiter = options.delimiter ?? ':';
    }
    /**
     * Builds the fully qualified cache key:
     * [app]:[env]:[prefix]:[namespace]:key
     */
    build(key) {
        if (!key || typeof key !== 'string') {
            throw new CacheKeyError('Cache key must be a non-empty string.');
        }
        if (INVALID_KEY_CHARS.test(key)) {
            throw new CacheKeyError(`Cache key contains invalid characters (control characters or whitespace): "${key}".`, key);
        }
        const segments = [];
        if (this.application)
            segments.push(this.application);
        if (this.environment)
            segments.push(this.environment);
        if (this.prefix)
            segments.push(this.prefix);
        if (this.namespace)
            segments.push(this.namespace);
        segments.push(key);
        const fullKey = segments.join(this.delimiter);
        if (fullKey.length > this.maxKeyLength) {
            throw new CacheKeyError(`Cache key length (${fullKey.length}) exceeds maximum allowed length of ${this.maxKeyLength} characters: "${fullKey.slice(0, 30)}..."`, fullKey);
        }
        return fullKey;
    }
    /**
     * Creates a sub-builder with an additional or nested namespace.
     */
    withNamespace(subNamespace) {
        const cleanSub = this.sanitizeSegment(subNamespace);
        const combined = this.namespace ? `${this.namespace}${this.delimiter}${cleanSub}` : cleanSub;
        return new CacheKeyBuilder({
            application: this.application,
            environment: this.environment,
            prefix: this.prefix,
            namespace: combined,
            maxKeyLength: this.maxKeyLength,
            delimiter: this.delimiter,
        });
    }
    sanitizeSegment(segment) {
        if (INVALID_KEY_CHARS.test(segment)) {
            throw new CacheKeyError(`Segment "${segment}" contains invalid control characters or whitespace.`);
        }
        return segment.trim();
    }
}
//# sourceMappingURL=key.js.map