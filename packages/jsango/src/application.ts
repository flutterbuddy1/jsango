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
import { Agent } from '@jsango/ai';
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

    // Swagger UI documentation page with high-contrast modern theme
    this.get('/docs', () => {
      return HttpResponse.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title ?? 'JSango API Documentation'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: #111827;
      --bg-card-hover: #1f2937;
      --bg-input: #1e293b;
      --border-subtle: #1e293b;
      --border-strong: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-primary: #6366f1;
      --accent-get: #10b981;
      --accent-post: #6366f1;
      --accent-put: #f59e0b;
      --accent-delete: #f43f5e;
      --accent-patch: #8b5cf6;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-main);
      color: var(--text-primary);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Brand Bar */
    .brand-header {
      background: rgba(11, 15, 25, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
    }
    .brand-badge {
      background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      padding: 4px 10px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .brand-title {
      color: var(--text-primary);
      font-weight: 700;
      font-size: 16px;
    }
    .spec-link {
      color: var(--accent-primary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    .spec-link:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: var(--accent-primary);
    }

    /* Swagger UI Overrides */
    .swagger-ui {
      color: var(--text-primary);
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Typography & Titles */
    .swagger-ui .info {
      margin: 24px 0 36px 0;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .swagger-ui .info .title {
      color: var(--text-primary) !important;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 800;
      font-size: 32px;
    }
    .swagger-ui .info .title small {
      background: var(--bg-card);
      border: 1px solid var(--border-strong);
      color: var(--accent-primary);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      margin-left: 12px;
    }
    .swagger-ui .info p,
    .swagger-ui .info li,
    .swagger-ui .info table {
      color: var(--text-secondary) !important;
      font-size: 14px;
      line-height: 1.6;
    }
    .swagger-ui .info a {
      color: #818cf8 !important;
    }

    /* Scheme Container */
    .swagger-ui .scheme-container {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      box-shadow: none;
      padding: 16px 24px;
      margin-bottom: 24px;
    }

    /* Section Tag Headers */
    .swagger-ui .opblock-tag {
      color: var(--text-primary) !important;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      font-size: 20px;
      border-bottom: 1px solid var(--border-subtle);
      padding: 16px 0;
    }
    .swagger-ui .opblock-tag small {
      color: var(--text-muted) !important;
      font-size: 13px;
    }
    .swagger-ui .opblock-tag:hover {
      color: #818cf8 !important;
    }

    /* Operation Blocks */
    .swagger-ui .opblock {
      background: var(--bg-card) !important;
      border-radius: 12px !important;
      border: 1px solid var(--border-subtle) !important;
      margin-bottom: 16px !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      transition: border-color 0.2s ease;
    }
    .swagger-ui .opblock:hover {
      border-color: var(--border-strong) !important;
    }
    .swagger-ui .opblock .opblock-summary {
      padding: 12px 16px;
      border-bottom: none;
    }
    .swagger-ui .opblock .opblock-summary-method {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 13px;
      border-radius: 6px;
      padding: 6px 14px;
      min-width: 80px;
      text-align: center;
      text-shadow: none;
    }
    .swagger-ui .opblock .opblock-summary-path {
      color: var(--text-primary) !important;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 500;
    }
    .swagger-ui .opblock .opblock-summary-description {
      color: var(--text-secondary) !important;
      font-size: 13px;
    }

    /* Method Specific Accents */
    .swagger-ui .opblock.opblock-get { border-left: 4px solid var(--accent-get) !important; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: rgba(16, 185, 129, 0.15) !important; color: #34d399 !important; }
    
    .swagger-ui .opblock.opblock-post { border-left: 4px solid var(--accent-post) !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: rgba(99, 102, 241, 0.15) !important; color: #a5b4fc !important; }

    .swagger-ui .opblock.opblock-put { border-left: 4px solid var(--accent-put) !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: rgba(245, 158, 11, 0.15) !important; color: #fbbf24 !important; }

    .swagger-ui .opblock.opblock-delete { border-left: 4px solid var(--accent-delete) !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: rgba(244, 63, 94, 0.15) !important; color: #fb7185 !important; }

    .swagger-ui .opblock.opblock-patch { border-left: 4px solid var(--accent-patch) !important; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: rgba(139, 92, 246, 0.15) !important; color: #c084fc !important; }

    /* Opblock Details / Body */
    .swagger-ui .opblock-body {
      background: #0d1322 !important;
      padding: 20px;
      border-top: 1px solid var(--border-subtle);
    }
    .swagger-ui .opblock-section-header {
      background: transparent !important;
      box-shadow: none !important;
      border-bottom: 1px solid var(--border-subtle);
      padding: 10px 0;
    }
    .swagger-ui .opblock-section-header h4 {
      color: var(--text-primary) !important;
      font-size: 14px;
      font-weight: 700;
    }

    /* Parameters & Tables */
    .swagger-ui table thead tr th,
    .swagger-ui table thead tr td {
      color: var(--text-secondary) !important;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--border-subtle);
    }
    .swagger-ui .parameters-col_name {
      color: var(--text-primary) !important;
    }
    .swagger-ui .parameter__name {
      color: #f1f5f9 !important;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 600;
    }
    .swagger-ui .parameter__name.required:after {
      color: #f43f5e !important;
    }
    .swagger-ui .parameter__type {
      color: #818cf8 !important;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .swagger-ui .parameter__in {
      color: var(--text-muted) !important;
      font-size: 12px;
    }
    .swagger-ui .parameter__deprecated {
      color: #f43f5e !important;
    }

    /* Responses */
    .swagger-ui .response-col_status {
      color: var(--text-primary) !important;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
    }
    .swagger-ui .response-col_description {
      color: var(--text-secondary) !important;
    }
    .swagger-ui .responses-inner h4,
    .swagger-ui .responses-inner h5 {
      color: var(--text-primary) !important;
    }

    /* Inputs, Selects & Buttons */
    .swagger-ui input[type="text"],
    .swagger-ui input[type="password"],
    .swagger-ui select,
    .swagger-ui textarea {
      background: var(--bg-input) !important;
      color: var(--text-primary) !important;
      border: 1px solid var(--border-strong) !important;
      border-radius: 8px !important;
      padding: 8px 12px !important;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .swagger-ui input[type="text"]:focus,
    .swagger-ui select:focus,
    .swagger-ui textarea:focus {
      border-color: var(--accent-primary) !important;
      outline: none;
    }
    .swagger-ui .btn {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 600;
      border-radius: 8px;
      padding: 6px 16px;
      transition: all 0.2s ease;
      border: 1px solid var(--border-strong);
      color: var(--text-primary);
      background: var(--bg-card);
    }
    .swagger-ui .btn.execute {
      background: #4f46e5 !important;
      border-color: #6366f1 !important;
      color: #fff !important;
      font-weight: 700;
    }
    .swagger-ui .btn.execute:hover {
      background: #4338ca !important;
    }
    .swagger-ui .btn.cancel {
      border-color: #f43f5e !important;
      color: #f43f5e !important;
    }
    .swagger-ui .btn.authorize {
      border-color: var(--accent-get) !important;
      color: var(--accent-get) !important;
    }
    .swagger-ui .btn.authorize svg {
      fill: var(--accent-get) !important;
    }

    /* Models & Schemas */
    .swagger-ui section.models {
      border: 1px solid var(--border-subtle);
      background: var(--bg-card);
      border-radius: 12px;
      margin-top: 32px;
    }
    .swagger-ui section.models h4 {
      color: var(--text-primary) !important;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      border-bottom: 1px solid var(--border-subtle);
    }
    .swagger-ui .model-box {
      background: #0d1322 !important;
      border-radius: 8px;
      padding: 12px;
    }
    .swagger-ui .model {
      color: var(--text-secondary) !important;
      font-family: 'JetBrains Mono', monospace;
    }
    .swagger-ui .model-title {
      color: var(--text-primary) !important;
      font-weight: 600;
    }
    .swagger-ui .prop-name {
      color: #93c5fd !important;
    }
    .swagger-ui .prop-type {
      color: #a78bfa !important;
    }

    /* Code Blocks & Microlight */
    .swagger-ui .highlight-code,
    .swagger-ui pre,
    .swagger-ui .microlight {
      background: #020617 !important;
      border: 1px solid var(--border-subtle) !important;
      border-radius: 8px !important;
      color: #e2e8f0 !important;
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 13px !important;
      padding: 14px !important;
    }
    .swagger-ui svg.arrow {
      fill: var(--text-secondary) !important;
    }
    .swagger-ui .response-control-media-type__title {
      color: var(--text-secondary) !important;
    }
  </style>
</head>
<body>
  <header class="brand-header">
    <div class="brand-logo">
      <span class="brand-badge">JSANGO</span>
      <span class="brand-title">${options.title ?? 'REST API'}</span>
    </div>
    <a href="${openapiPath}" target="_blank" class="spec-link">
      <span>Raw OpenAPI JSON ↗</span>
    </a>
  </header>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '${openapiPath}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`);
    });


    return this;
  }

  /**
   * Mounts an AI Agent as an HTTP endpoint.
   * Handles POST /agent with JSON { input, conversationId, context }
   * and GET /agent?input=... with optional Server-Sent Events (SSE) streaming.
   */
  public agent(path: string, targetAgent: Agent, options?: { maxSteps?: number }): this {
    // POST Handler
    this.post(path, async (ctx: any) => {
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const input = body?.input ?? body?.message ?? '';
      const conversationId = body?.conversationId ?? body?.sessionId;
      const userContext = (ctx.request as any).identity ?? (ctx.request as any).user;

      const result = await targetAgent.run({
        input,
        maxSteps: options?.maxSteps,
        context: {
          user: userContext,
          conversationId,
          requestId: ctx.request.id,
        },
      });

      return HttpResponse.json(result);
    });

    // GET / SSE Handler
    this.get(path, async (ctx: any) => {
      const input = (ctx.request.query?.['input'] ?? ctx.request.query?.['q'] ?? '') as string;
      const conversationId = ctx.request.query?.['conversationId'] as string | undefined;
      const wantsStream =
        ctx.request.query?.['stream'] === 'true' ||
        ctx.request.headers.get('accept')?.includes('text/event-stream');

      if (!wantsStream) {
        const result = await targetAgent.run({
          input,
          context: { conversationId, requestId: ctx.request.id },
        });
        return HttpResponse.json(result);
      }

      // SSE Streaming response
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of targetAgent.stream({
              input,
              context: { conversationId, requestId: ctx.request.id },
            })) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
            }
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (err: unknown) {
            controller.error(err);
          }
        },
      });

      return new HttpResponse(readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    });


    return this;
  }

  /**
   * Mounts an AI Agent as a Real-time WebSocket endpoint.
   * Streams token deltas, tool calls, and progress events automatically.
   */
  public wsAgent(path: string, targetAgent: Agent): this {
    return this.ws(path, (socket) => {
      socket.on('message', async (data: any) => {
        const input = typeof data === 'string' ? data : data?.input ?? data?.text ?? '';
        const conversationId = data?.conversationId ?? socket.id;

        try {
          socket.send({ type: 'run.started', agent: targetAgent.name, input });

          for await (const event of targetAgent.stream({
            input,
            context: {
              conversationId,
              requestId: `ws_${socket.id}_${Date.now()}`,
            },
          })) {
            socket.send(event);
          }
        } catch (err: unknown) {
          socket.send({
            type: 'run.failed',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    });
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
