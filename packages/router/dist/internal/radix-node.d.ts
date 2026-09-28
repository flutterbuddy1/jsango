import type { HttpMethod } from '@jsango/http';
import type { Route } from '../public/route.js';
import type { CompiledConstraint } from '../public/constraints.js';
export interface ParamChild {
    readonly paramName: string;
    readonly constraintDef?: string | undefined;
    readonly constraint?: CompiledConstraint | undefined;
    readonly node: RadixNode;
}
export interface WildcardChild {
    readonly paramName: string;
    readonly node: RadixNode;
}
export declare class RadixNode {
    readonly staticChildren: Map<string, RadixNode>;
    readonly paramChildren: ParamChild[];
    wildcardChild: WildcardChild | null;
    readonly routes: Map<HttpMethod, Route>;
}
//# sourceMappingURL=radix-node.d.ts.map