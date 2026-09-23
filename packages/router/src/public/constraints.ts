import { InvalidRoutePatternError } from './errors.js';

export type BuiltinConstraint = 'number' | 'uuid' | 'slug' | 'alpha' | 'alphanumeric';

export type RouteConstraintDefinition =
  BuiltinConstraint | string | RegExp | ((value: string) => boolean);

const BUILTIN_REGEXPS: Record<BuiltinConstraint, RegExp> = {
  number: /^\d+$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  slug: /^[a-z0-9_-]+$/,
  alpha: /^[a-zA-Z]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
};

export type CompiledConstraint = (value: string) => boolean;

export function resolveConstraint(def: RouteConstraintDefinition): CompiledConstraint {
  if (typeof def === 'function') {
    return def;
  }

  if (def instanceof RegExp) {
    return (val: string) => {
      def.lastIndex = 0;
      return def.test(val);
    };
  }

  if (typeof def === 'string') {
    const builtin = BUILTIN_REGEXPS[def.toLowerCase() as BuiltinConstraint];
    if (builtin) {
      return (val: string) => builtin.test(val);
    }

    // Try custom regex string (e.g. [0-9]+ or [a-z]{2,4})
    try {
      const customRegex = new RegExp(`^${def}$`);
      return (val: string) => customRegex.test(val);
    } catch {
      throw new InvalidRoutePatternError(def, `Invalid constraint pattern: "${def}"`);
    }
  }

  throw new InvalidRoutePatternError(String(def), 'Invalid constraint definition type.');
}
