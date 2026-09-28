import { InvalidRoutePatternError } from './errors.js';
const BUILTIN_REGEXPS = {
    number: /^\d+$/,
    uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    slug: /^[a-z0-9_-]+$/,
    alpha: /^[a-zA-Z]+$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
};
export function resolveConstraint(def) {
    if (typeof def === 'function') {
        return def;
    }
    if (def instanceof RegExp) {
        return (val) => {
            def.lastIndex = 0;
            return def.test(val);
        };
    }
    if (typeof def === 'string') {
        const builtin = BUILTIN_REGEXPS[def.toLowerCase()];
        if (builtin) {
            return (val) => builtin.test(val);
        }
        // Try custom regex string (e.g. [0-9]+ or [a-z]{2,4})
        try {
            const customRegex = new RegExp(`^${def}$`);
            return (val) => customRegex.test(val);
        }
        catch {
            throw new InvalidRoutePatternError(def, `Invalid constraint pattern: "${def}"`);
        }
    }
    throw new InvalidRoutePatternError(String(def), 'Invalid constraint definition type.');
}
//# sourceMappingURL=constraints.js.map