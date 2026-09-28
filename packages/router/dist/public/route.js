export class Route {
    method;
    path;
    handler;
    metadata;
    constraints;
    paramNames;
    middleware;
    _name;
    constructor(method, path, handler, options = {}, paramNames = []) {
        this.method = method;
        this.path = path;
        this.handler = handler;
        this._name = options.name;
        this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
        this.constraints = Object.freeze({ ...(options.constraints ?? {}) });
        this.paramNames = Object.freeze([...paramNames]);
        this.middleware = Object.freeze([...(options.middleware ?? [])]);
    }
    get routeName() {
        return this._name;
    }
    /**
     * Fluent method to assign or update the route's unique name.
     */
    name(name) {
        this._name = name;
        return this;
    }
}
//# sourceMappingURL=route.js.map