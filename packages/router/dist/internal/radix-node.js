export class RadixNode {
    // O(1) hash map for static string segments
    staticChildren = new Map();
    // Prioritized array: constrained params evaluated before unconstrained params
    paramChildren = [];
    // Terminal wildcard capturing the remainder of the path
    wildcardChild = null;
    // Registered HTTP routes at this node
    routes = new Map();
}
//# sourceMappingURL=radix-node.js.map