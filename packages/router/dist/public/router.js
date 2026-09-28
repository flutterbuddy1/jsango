import { HttpResponse, HttpStatus } from '@jsango/http';
import { Route } from './route.js';
import { RouteGroup } from './group.js';
import { RadixTree } from '../internal/radix-tree.js';
import { normalizePath } from '../internal/path-utils.js';
import { DuplicateRouteNameError, RouteNotFoundError, RouterLockedError, InvalidRoutePatternError, } from './errors.js';
export class Router {
    tree = new RadixTree();
    registeredRoutes = [];
    namedRoutes = new Map();
    _state = 'registering';
    get state() {
        return this._state;
    }
    get isLocked() {
        return this._state === 'locked' || this._state === 'compiled';
    }
    compile() {
        if (!this.isLocked) {
            this._state = 'locked';
            this.tree.lock();
        }
        return this;
    }
    lock() {
        return this.compile();
    }
    assertNotLocked() {
        if (this.isLocked) {
            throw new RouterLockedError();
        }
    }
    route(method, path, handler, options = {}) {
        this.assertNotLocked();
        const normalized = normalizePath(path);
        const routeInstance = new Route(method, normalized, handler, options);
        this.tree.insert(routeInstance);
        this.registeredRoutes.push(routeInstance);
        if (options.name) {
            this.registerRouteName(options.name, routeInstance);
        }
        // Intercept fluent .name() call
        const originalNameMethod = routeInstance.name.bind(routeInstance);
        routeInstance.name = (newName) => {
            this.registerRouteName(newName, routeInstance);
            return originalNameMethod(newName);
        };
        return routeInstance;
    }
    registerRouteName(name, route) {
        const existing = this.namedRoutes.get(name);
        if (existing && existing !== route) {
            throw new DuplicateRouteNameError(name, existing.path, route.path);
        }
        this.namedRoutes.set(name, route);
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
        this.assertNotLocked();
        let prefix;
        let groupMetadata = {};
        let groupMiddleware = [];
        if (typeof prefixOrConfig === 'string') {
            prefix = prefixOrConfig;
            groupMetadata = options.metadata ?? {};
            groupMiddleware = options.middleware ?? [];
        }
        else {
            prefix = prefixOrConfig.prefix;
            groupMetadata = prefixOrConfig.metadata ?? {};
            groupMiddleware = prefixOrConfig.middleware ?? [];
        }
        const groupInstance = new RouteGroup(this, prefix, {
            metadata: groupMetadata,
            middleware: groupMiddleware,
        });
        callback(groupInstance);
        return this;
    }
    match(method, path) {
        return this.tree.search(method, path);
    }
    routes() {
        return Object.freeze([...this.registeredRoutes]);
    }
    getRouteByName(name) {
        return this.namedRoutes.get(name);
    }
    url(name, params = {}) {
        const route = this.namedRoutes.get(name);
        if (!route) {
            throw new RouteNotFoundError(name);
        }
        let generatedPath = route.path;
        const unusedParams = { ...params };
        // Replace optional parameters: /:param? or /:param<constraint>?
        generatedPath = generatedPath.replace(/\/?:([a-zA-Z0-9_]+)(?:<.+?>)?\?/g, (match, paramName) => {
            const val = unusedParams[paramName];
            if (typeof val !== 'undefined') {
                delete unusedParams[paramName];
                return match.startsWith('/')
                    ? `/${encodeURIComponent(String(val))}`
                    : encodeURIComponent(String(val));
            }
            return '';
        });
        // Replace required parameters: :param or :param<constraint>
        generatedPath = generatedPath.replace(/:([a-zA-Z0-9_]+)(?:<.+?>)?/g, (_, paramName) => {
            const val = unusedParams[paramName];
            if (typeof val === 'undefined') {
                throw new InvalidRoutePatternError(route.path, `Missing required route parameter "${paramName}" for route "${name}".`);
            }
            delete unusedParams[paramName];
            return encodeURIComponent(String(val));
        });
        // Replace *wildcards
        generatedPath = generatedPath.replace(/\*([a-zA-Z0-9_]*)/g, (_, wildcardName) => {
            const key = wildcardName || 'wildcard';
            const val = unusedParams[key];
            if (typeof val === 'undefined') {
                return '';
            }
            delete unusedParams[key];
            return String(val);
        });
        // Ensure generatedPath starts with / and clean duplicate slashes
        if (!generatedPath.startsWith('/')) {
            generatedPath = '/' + generatedPath;
        }
        generatedPath = generatedPath.replace(/\/+/g, '/');
        if (generatedPath.length > 1 && generatedPath.endsWith('/')) {
            generatedPath = generatedPath.slice(0, -1);
        }
        // Append extra parameters as query string
        const remainingKeys = Object.keys(unusedParams);
        if (remainingKeys.length > 0) {
            const searchParams = new URLSearchParams();
            for (const key of remainingKeys) {
                searchParams.append(key, String(unusedParams[key]));
            }
            generatedPath += `?${searchParams.toString()}`;
        }
        return generatedPath;
    }
    /**
     * Dispatches a RequestContext against the route table and returns the resulting HttpResponse.
     */
    async handle(ctx) {
        const match = this.match(ctx.request.method, ctx.request.pathname);
        if (match.type === 'MATCHED') {
            // Expose matched parameters on request
            ctx.request.params = match.params;
            const raw = await match.handler(ctx);
            const response = raw instanceof HttpResponse
                ? raw
                : raw === undefined || raw === null
                    ? HttpResponse.empty()
                    : typeof raw === 'string'
                        ? HttpResponse.text(raw)
                        : HttpResponse.json(raw);
            // If HEAD request matched a GET handler via fallback, discard response body
            if (match.isHeadFallback && ctx.request.method === 'HEAD') {
                response.body = null;
            }
            return response;
        }
        if (match.type === 'METHOD_NOT_ALLOWED') {
            const allowHeader = match.allowedMethods.join(', ');
            return HttpResponse.json({
                error: {
                    code: 'ERR_HTTP_METHOD_NOT_ALLOWED',
                    message: `Method ${ctx.request.method} is not allowed for path "${ctx.request.pathname}".`,
                },
            }, {
                status: HttpStatus.METHOD_NOT_ALLOWED,
                headers: {
                    allow: allowHeader,
                },
            });
        }
        // NOT_FOUND
        return HttpResponse.json({
            error: {
                code: 'ERR_HTTP_NOT_FOUND',
                message: `Cannot ${ctx.request.method} ${ctx.request.pathname}`,
            },
        }, { status: HttpStatus.NOT_FOUND });
    }
}
//# sourceMappingURL=router.js.map