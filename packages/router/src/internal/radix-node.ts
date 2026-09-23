import type { HttpMethod } from '@django-js/http';
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

export class RadixNode {
  // O(1) hash map for static string segments
  public readonly staticChildren = new Map<string, RadixNode>();

  // Prioritized array: constrained params evaluated before unconstrained params
  public readonly paramChildren: ParamChild[] = [];

  // Terminal wildcard capturing the remainder of the path
  public wildcardChild: WildcardChild | null = null;

  // Registered HTTP routes at this node
  public readonly routes = new Map<HttpMethod, Route>();
}
