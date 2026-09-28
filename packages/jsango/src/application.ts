import {
  Application as MiddlewareApplication,
  type ApplicationOptions,
  type MiddlewareDefinition,
  type ErrorHandler,
} from '@jsango/middleware';
import {
  HttpRequest,
  HttpResponse,
  RequestContext,
  createNodeHttpServer,
  type IHttpServer,
} from '@jsango/http';
import type { RouteHandler, RouteOptions, RouteGroup, RouteGroupConfig, RouteGroupOptions } from '@jsango/router';
import { defaultModelRegistry, type DefinedModelStatic, type Model } from '@jsango/orm';
import { AdminRegistry } from '@jsango/admin-core';
import { AdminServer, type IAdminQueryAdapter, type AdminListQuery, type AdminListResult } from '@jsango/admin-server';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import { OpenApiRegistry, OpenApiGenerator } from '@jsango/openapi';
import { WebSocketEndpointManager, type WebSocketRouteCallback } from './websocket-wrapper.js';

export interface CrudOptions {
  readonly searchFields?: readonly string[];
  readonly defaultPageSize?: number;
  readonly maxPageSize?: number;
}

export interface AdminOptions {
  readonly prefix?: string;
  readonly resources?: readonly (DefinedModelStatic<any, any> | Model)[];
}

export interface OpenApiOptions {
  readonly path?: string;
  readonly title?: string;
  readonly version?: string;
  readonly description?: string;
}

function parseRouteArgs(args: any[]): { handler: RouteHandler; options: RouteOptions } {
  let options: Record<string, any> = {};
  const functions: Function[] = [];

  for (const arg of args) {
    if (typeof arg === 'function') {
      functions.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      options = { ...options, ...arg };
    }
  }

  if (functions.length === 0) {
    throw new Error('Route requires at least one handler function.');
  }

  const handler = functions[functions.length - 1] as RouteHandler;
  const middlewares = functions.slice(0, functions.length - 1);

  const existingMw = options.middleware ? (Array.isArray(options.middleware) ? options.middleware : [options.middleware]) : [];
  options.middleware = [...existingMw, ...middlewares];

  return { handler, options };
}

export class JSangoApplication {
  public readonly app: MiddlewareApplication;
  private readonly wsManager = new WebSocketEndpointManager();
  private readonly openapiRegistry = new OpenApiRegistry();
  private isProduction: boolean;

  constructor(options: ApplicationOptions = {}) {
    this.isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');
    this.app = new MiddlewareApplication({
      ...options,
      isProduction: this.isProduction,
    });
  }

  public use(...middleware: MiddlewareDefinition[]): this {
    this.app.use(...middleware);
    return this;
  }

  public registerMiddleware(name: string, middleware: any): this {
    this.app.registerMiddleware(name, middleware);
    return this;
  }

  public setErrorHandler(handler: ErrorHandler): this {
    this.app.setErrorHandler(handler);
    return this;
  }

  // --- HTTP Methods with Automatic Variadic Middleware Support ---

  public get(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.get(path, handler, options);
    return this;
  }

  public post(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.post(path, handler, options);
    return this;
  }

  public put(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.put(path, handler, options);
    return this;
  }

  public patch(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.patch(path, handler, options);
    return this;
  }

  public delete(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.delete(path, handler, options);
    return this;
  }

  public head(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.head(path, handler, options);
    return this;
  }

  public options(path: string, ...handlers: any[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.options(path, handler, options);
    return this;
  }

  public group(
    prefixOrConfig: string | RouteGroupConfig,
    callback: (group: RouteGroup) => void,
    options?: RouteGroupOptions
  ): this {
    this.app.group(prefixOrConfig, callback, options);
    return this;
  }

  // --- WebSocket Simplicity ---

  public ws(path: string, callback: WebSocketRouteCallback): this {
    this.wsManager.register(path, callback);
    return this;
  }

  // --- CRUD Generation ---

  public crud(basePath: string, modelClass: DefinedModelStatic<any, any>, options?: CrudOptions): this {
    const rootPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    const idPath = `${rootPath}/:id`;
    const defaultPageSize = options?.defaultPageSize ?? 20;

    // 1. List
    this.get(rootPath, async (ctx: RequestContext) => {
      const page = Math.max(1, parseInt(ctx.request.query.get('page') ?? '1', 10));
      const pageSize = Math.min(
        options?.maxPageSize ?? 100,
        Math.max(1, parseInt(ctx.request.query.get('pageSize') ?? String(defaultPageSize), 10))
      );
      const search = ctx.request.query.get('search');

      let query = modelClass.query();

      if (search && options?.searchFields && options.searchFields.length > 0) {
        for (const field of options.searchFields) {
          query = query.orWhere(field, 'LIKE', `%${search}%`);
        }
      }

      return query.paginate({ page, pageSize });
    });

    // 2. Detail
    this.get(idPath, async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = await modelClass.find(id);
      if (!item) {
        return HttpResponse.notFound(`Item with id "${id}" not found.`);
      }
      return item;
    });

    // 3. Create
    this.post(rootPath, async (ctx: RequestContext) => {
      const body = (await ctx.request.body.json().catch(() => ({}))) as Record<string, unknown>;
      const item = await modelClass.create(body as any);
      return HttpResponse.created(item);
    });

    // 4. Update
    const updateHandler: RouteHandler = async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = await modelClass.find(id);
      if (!item) {
        return HttpResponse.notFound(`Item with id "${id}" not found.`);
      }
      const body = (await ctx.request.body.json().catch(() => ({}))) as Record<string, unknown>;
      for (const [key, val] of Object.entries(body)) {
        item.set(key, val);
      }
      await item.save();
      return item;
    };
    this.put(idPath, updateHandler);
    this.patch(idPath, updateHandler);

    // 5. Delete
    this.delete(idPath, async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = await modelClass.find(id);
      if (!item) {
        return HttpResponse.notFound(`Item with id "${id}" not found.`);
      }
      await item.delete();
      return HttpResponse.noContent();
    });

    return this;
  }

  // --- Automatic Admin Mounting ---

  public admin(options: AdminOptions = {}): this {
    const prefix = options.prefix ?? '/admin/api/v1';
    const registry = new AdminRegistry();

    if (options.resources) {
      for (const res of options.resources) {
        registry.register(res as any);
      }
    }

    const permissions = new AdminPermissionChecker();
    const audit = new AdminAuditLogger({ store: new InMemoryAuditStore() });

    const queryAdapter: IAdminQueryAdapter = {
      async list(opts: { modelName: string; query: AdminListQuery; searchFields: readonly string[]; pageSize: number }): Promise<AdminListResult> {
        const modelClass = defaultModelRegistry.getModel(opts.modelName);
        if (!modelClass) {
          return { items: [], total: 0, page: 1, pageSize: opts.pageSize, totalPages: 0 };
        }
        let q = modelClass.query();
        if (opts.query.search && opts.searchFields.length > 0) {
          for (const f of opts.searchFields) {
            q = q.orWhere(f, 'LIKE', `%${opts.query.search}%`);
          }
        }
        const page = opts.query.page ?? 1;
        const pageSize = opts.query.pageSize ?? opts.pageSize;
        const res = await q.paginate({ page, pageSize });
        return {
          items: res.items.map((i: any) => (i.toJSON ? i.toJSON() : i.getAttributes())),
          total: res.total,
          page: res.page,
          pageSize: res.pageSize,
          totalPages: res.totalPages,
        };
      },
      async findById(opts: { modelName: string; id: string | number }): Promise<Record<string, unknown> | null> {
        const modelClass = defaultModelRegistry.getModel(opts.modelName);
        if (!modelClass) return null;
        const found = await modelClass.find(opts.id);
        return found ? (found.toJSON ? found.toJSON() : found.getAttributes()) : null;
      },
      async create(opts: { modelName: string; data: Record<string, unknown> }): Promise<Record<string, unknown>> {
        const modelClass = defaultModelRegistry.getModel(opts.modelName);
        if (!modelClass) throw new Error(`Model ${opts.modelName} not found`);
        const item = await modelClass.create(opts.data as any);
        return item.toJSON ? item.toJSON() : item.getAttributes();
      },
      async update(opts: { modelName: string; id: string | number; data: Record<string, unknown> }): Promise<Record<string, unknown>> {
        const modelClass = defaultModelRegistry.getModel(opts.modelName);
        if (!modelClass) throw new Error(`Model ${opts.modelName} not found`);
        const item = await modelClass.findOrFail(opts.id);
        for (const [k, v] of Object.entries(opts.data)) {
          item.set(k, v);
        }
        await item.save();
        return item.toJSON ? item.toJSON() : item.getAttributes();
      },
      async delete(options: { modelName: string; id: string | number; primaryKey: string; soft?: boolean | undefined }): Promise<void> {
        const modelClass = defaultModelRegistry.getModel(options.modelName);
        if (!modelClass) return;
        const item = await modelClass.find(options.id);
        if (item) {
          await item.delete({ force: !options.soft });
        }
      },
    };

    const adminServer = new AdminServer({
      registry,
      permissions,
      audit,
      queryAdapter,
      prefix,
    });

    adminServer.mount(this.app.router);
    return this;
  }

  // --- Automatic OpenAPI Mounting ---

  public openapi(options: OpenApiOptions = {}): this {
    const openapiPath = options.path ?? '/openapi.json';
    const generator = new OpenApiGenerator({
      info: {
        title: options.title ?? 'JSango Application API',
        version: options.version ?? '1.0.0',
        description: options.description ?? 'REST API built with JSango',
      },
      registry: this.openapiRegistry,
    });

    this.get(openapiPath, () => {
      return generator.generate(this.app.router);
    });

    // Swagger UI fallback page
    this.get('/docs', () => {
      return HttpResponse.html(`<!DOCTYPE html>
<html>
<head>
  <title>${options.title ?? 'API Documentation'}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0; background:#0f172a;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '${openapiPath}',
      dom_id: '#swagger-ui',
      deepLinking: true
    });
  </script>
</body>
</html>`);
    });

    return this;
  }

  // --- Request Lifecycle & Listening ---

  public async handle(input: HttpRequest | RequestContext): Promise<HttpResponse> {
    return this.app.handle(input);
  }

  public async listen(port = 3000, host = '127.0.0.1'): Promise<IHttpServer> {
    const server = createNodeHttpServer(async (ctx) => this.app.handle(ctx), {
      logger: this.app.logger,
      isProduction: this.isProduction,
    });

    await server.listen(port, host);

    // If WebSocket routes are registered, bind the WebSocket upgrade listener
    if (this.wsManager.hasRoutes() && 'getUnderlyingServer' in server) {
      const nodeHttpServer = (server as { getUnderlyingServer(): any }).getUnderlyingServer();
      if (nodeHttpServer) {
        this.wsManager.attach(nodeHttpServer);
      }
    }

    if (!this.isProduction && process.env.NODE_ENV !== 'test') {
      console.log(`\n  ⚡ JSango Server running at http://${host}:${port}`);
      const wsRoutes = this.wsManager.getRoutes();
      if (wsRoutes.length > 0) {
        console.log(`  🔌 WebSocket routes: ${wsRoutes.join(', ')}`);
      }
      console.log('');
    }

    return server;
  }
}

/**
 * Creates and configures a new JSango application instance.
 */
export function createApp(options?: ApplicationOptions): JSangoApplication {
  return new JSangoApplication(options);
}
