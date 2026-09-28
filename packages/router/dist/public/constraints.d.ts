export type BuiltinConstraint = 'number' | 'uuid' | 'slug' | 'alpha' | 'alphanumeric';
export type RouteConstraintDefinition = BuiltinConstraint | string | RegExp | ((value: string) => boolean);
export type CompiledConstraint = (value: string) => boolean;
export declare function resolveConstraint(def: RouteConstraintDefinition): CompiledConstraint;
//# sourceMappingURL=constraints.d.ts.map