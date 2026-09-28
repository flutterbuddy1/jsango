import type { HttpMethod } from '@jsango/http';
import type { Route } from '../public/route.js';
import type { RouteMatchResult } from '../public/result.js';
export declare class RadixTree {
    private readonly root;
    private readonly staticRouteMap;
    private _isLocked;
    get isLocked(): boolean;
    lock(): void;
    insert(route: Route): void;
    private insertSegments;
    search(method: HttpMethod, rawPath: string): RouteMatchResult;
}
//# sourceMappingURL=radix-tree.d.ts.map