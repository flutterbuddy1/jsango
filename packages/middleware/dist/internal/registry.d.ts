import type { Middleware, MiddlewareDefinition } from '../public/types.js';
export declare class MiddlewareRegistry {
    private readonly named;
    register(name: string, middleware: Middleware): void;
    has(name: string): boolean;
    get(name: string): Middleware | undefined;
    resolve(def: MiddlewareDefinition): Middleware;
    resolveAll(definitions: readonly MiddlewareDefinition[]): Middleware[];
}
//# sourceMappingURL=registry.d.ts.map