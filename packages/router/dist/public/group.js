import { joinPaths } from '../internal/path-utils.js';
export class RouteGroup {
    router;
    prefix;
    metadata;
    middleware;
    constructor(router, prefix, options = {}) {
        this.router = router;
        this.prefix = prefix;
        this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
        this.middleware = Object.freeze([...(options.middleware ?? [])]);
    }
    route(method, path, handler, options = {}) {
        const fullPath = joinPaths(this.prefix, path);
        const mergedMetadata = {
            ...this.metadata,
            ...(options.metadata ?? {}),
        };
        const mergedMiddleware = [...this.middleware, ...(options.middleware ?? [])];
        return this.router.route(method, fullPath, handler, {
            ...options,
            metadata: mergedMetadata,
            middleware: mergedMiddleware,
        });
    }
    get(path, handler, options = {}) {
        return this.route('GET', path, handler, options);
    }
    post(path, handler, options = {}) {
        return this.route('POST', path, handler, options);
    }
    put(path, handler, options = {}) {
        return this.route('PUT', path, handler, options);
    }
    patch(path, handler, options = {}) {
        return this.route('PATCH', path, handler, options);
    }
    delete(path, handler, options = {}) {
        return this.route('DELETE', path, handler, options);
    }
    head(path, handler, options = {}) {
        return this.route('HEAD', path, handler, options);
    }
    options(path, handler, options = {}) {
        return this.route('OPTIONS', path, handler, options);
    }
    group(prefixOrConfig, callback, options = {}) {
        let subPrefix;
        let groupMetadata = {};
        let groupMiddleware = [];
        if (typeof prefixOrConfig === 'string') {
            subPrefix = prefixOrConfig;
            groupMetadata = options.metadata ?? {};
            groupMiddleware = options.middleware ?? [];
        }
        else {
            subPrefix = prefixOrConfig.prefix;
            groupMetadata = prefixOrConfig.metadata ?? {};
            groupMiddleware = prefixOrConfig.middleware ?? [];
        }
        const fullPrefix = joinPaths(this.prefix, subPrefix);
        const mergedMetadata = {
            ...this.metadata,
            ...groupMetadata,
        };
        const mergedMiddleware = [...this.middleware, ...groupMiddleware];
        const subGroup = new RouteGroup(this.router, fullPrefix, {
            metadata: mergedMetadata,
            middleware: mergedMiddleware,
        });
        callback(subGroup);
        return this;
    }
}
//# sourceMappingURL=group.js.map