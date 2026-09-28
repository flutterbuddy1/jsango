import { NamedMiddlewareNotFoundError } from '../public/errors.js';
export class MiddlewareRegistry {
    named = new Map();
    register(name, middleware) {
        this.named.set(name, middleware);
    }
    has(name) {
        return this.named.has(name);
    }
    get(name) {
        return this.named.get(name);
    }
    resolve(def) {
        if (typeof def === 'string') {
            const mw = this.named.get(def);
            if (!mw) {
                throw new NamedMiddlewareNotFoundError(def);
            }
            return mw;
        }
        return def;
    }
    resolveAll(definitions) {
        return definitions.map((def) => this.resolve(def));
    }
}
//# sourceMappingURL=registry.js.map