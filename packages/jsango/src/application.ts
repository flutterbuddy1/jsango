import { randomUUID } from 'node:crypto';
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
  ForbiddenError,
  BadRequestError,
  createNodeHttpServer,
  type IHttpServer,
} from '@jsango/http';
import type { IValidator } from '@jsango/validation';
import { isProductionEnv } from '@jsango/core';
import { StructuredLogger } from '@jsango/observability';
import type {
  RouteHandler,
  RouteOptions,
  RouteGroup,
  RouteGroupConfig,
  RouteGroupOptions,
} from '@jsango/router';
import {
  defaultModelRegistry,
  getDatabaseManager,
  hasDatabaseManager,
  transaction,
  type DefinedModelStatic,
  type Model,
  type QueryBuilder,
} from '@jsango/orm';
import {
  AdminRegistry,
  AdminResource,
  type AdminPage,
  type AdminResourceOptions,
  type DashboardWidget,
} from '@jsango/admin-core';
import { AdminServer, type IAdminQueryAdapter, type AdminListQuery } from '@jsango/admin-server';
import { AdminPermissionChecker, type AdminAuthOptions } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore, type IAuditStore } from '@jsango/admin-audit';
import { AdminMediaManager, LocalDiskMediaStorage, type IMediaStorage } from '@jsango/admin-media';
import { Auth, getIdentity, type AuthStore } from '@jsango/auth';
import { createAdminUiHandler } from '@jsango/admin-ui';
import { OpenApiRegistry, OpenApiGenerator } from '@jsango/openapi';
import { Agent, type AgentRunResult } from '@jsango/ai';
import {
  WebSocketEndpointManager,
  type ISimpleWebSocket,
  type RoomSender,
  type WebSocketRouteCallback,
} from './websocket-wrapper.js';

export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete';

/** `'public'`, or middleware such as `auth.required({ roles: ['admin'] })`. */
export type CrudAccess =
  'public' | ((ctx: RequestContext, next: () => Promise<HttpResponse>) => unknown);

export interface CrudOptions {
  /** Fields matched by `?search=text` (case-insensitive contains). */
  readonly searchFields?: readonly string[];
  /** Fields that can be filtered by exact value: `GET /posts?published=true&authorId=3`. */
  readonly filterFields?: readonly string[];
  readonly defaultPageSize?: number;
  readonly maxPageSize?: number;
  /**
   * Who can call the routes: one value for all of them, or per operation (`read` = list + detail,
   * `write` = create + update + delete). Default: reads are public and writes answer 403 until
   * you allow them, e.g. `access: { write: auth.required({ roles: ['admin'] }) }`.
   */
  readonly access?: CrudAccess | Partial<Record<CrudOperation | 'read' | 'write', CrudAccess>>;
  /** Register only these routes, e.g. `['list', 'detail']`. Default: all five. */
  readonly only?: readonly CrudOperation[];
  /**
   * Fields the request body may set; anything else is ignored. Default: every model field except
   * the primary key, timestamps, the soft-delete column and `hidden` fields.
   */
  readonly writable?: readonly string[];
  /** Fields never sent in responses. Default: names with password, secret, token, apiKey or hash. */
  readonly hidden?: readonly string[];
  /**
   * Validates writes (`schema({ ... })`): the body on create, the record with the changes applied
   * on update. Failures answer 400 with the field errors.
   */
  readonly schema?: IValidator<any>;
  /** Limits every list / detail / update / delete query, e.g. to the signed-in user's rows. */
  readonly scope?: (query: QueryBuilder<any>, ctx: RequestContext) => QueryBuilder<any>;
  /**
   * Business logic around writes. They run in one database transaction with the write: throw
   * (`badRequest(...)`, `forbidden(...)`) to cancel it. `before*` hooks may return changed data.
   */
  readonly hooks?: CrudHooks;
}

type CrudData = Record<string, unknown>;

export interface CrudHooks {
  beforeCreate?(data: CrudData, ctx: RequestContext): CrudData | void | Promise<CrudData | void>;
  afterCreate?(item: Model, ctx: RequestContext): unknown;
  beforeUpdate?(
    data: CrudData,
    item: Model,
    ctx: RequestContext
  ): CrudData | void | Promise<CrudData | void>;
  afterUpdate?(item: Model, ctx: RequestContext): unknown;
  beforeDelete?(item: Model, ctx: RequestContext): unknown;
  afterDelete?(item: Model, ctx: RequestContext): unknown;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SENSITIVE_FIELD = /password|secret|token|api_?key|hash/i;
/** Never writable by default: a user could otherwise grant themselves a role. */
const PRIVILEGE_FIELD =
  /^(is_?(admin|superuser|staff|verified)|roles?|permissions|email_?verified)$/i;

/** A query-string integer, or the default when missing / not a number. */
const intParam = (raw: string | null | undefined, fallback: number) => {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export interface AgentRouteOptions {
  /** Route middleware, e.g. `[auth.required()]` or a rate limiter. Default: none (public). */
  readonly middleware?: readonly RouteArg[];
  /** Model calls per run. Default: the agent's own (10). */
  readonly maxSteps?: number;
  /** Longest accepted input in characters. Default 10,000. */
  readonly maxInputLength?: number;
}

/**
 * What the HTTP API returns: the answer, tool calls and usage, never `messages` (the whole history,
 * including the system prompt) or raw errors.
 */
function publicResult(result: AgentRunResult, conversationId: string) {
  return {
    runId: result.runId,
    conversationId,
    status: result.status,
    text: result.text,
    output: result.output,
    toolCalls: result.toolCalls.map(({ name, durationMs }) => ({ name, durationMs })),
    usage: result.usage,
    durationMs: result.durationMs,
    approvalRequest: result.approvalRequest,
  };
}

export interface AdminOptions {
  /**
   * Browser URL path where the React Admin UI SPA is accessible.
   * @default '/admin'
   */
  readonly path?: string;
  /**
   * Alias for path (e.g. '/admin-panel').
   */
  readonly prefix?: string;
  /**
   * REST API prefix for @jsango/admin-server backend endpoints.
   * @default `${path}/api/v1`
   */
  readonly apiPrefix?: string;
  /**
   * Branding title displayed in the Admin UI header and page title.
   * @default 'JSango Administration'
   */
  readonly title?: string;
  /**
   * Default theme mode ('light', 'dark', or 'system').
   * @default 'dark'
   */
  readonly defaultTheme?: 'light' | 'dark' | 'system';
  /**
   * Subtitle displayed under the brand title.
   * @default 'Enterprise Admin Control'
   */
  readonly brandSubtitle?: string;
  /**
   * Who can sign in:
   * - `createAuth(...)`: your application's users (scrypt passwords, lockout, two-factor). Users
   *   need the `admin`/`staff` role, the `admin.access` permission or `isSuperuser`.
   * - `{ email, password }`: a single built-in super admin (or `JSANGO_ADMIN_EMAIL` /
   *   `JSANGO_ADMIN_PASSWORD`). Without a password, login is refused in production.
   */
  readonly auth?: Auth<any> | AdminCredentials;
  /** Alias for a built-in super admin account. */
  readonly credentials?: AdminCredentials;
  /**
   * ORM models (screens generated from the model), `{ model, ...options }` to customize columns,
   * search, filters, actions and permissions, or `new AdminResource({...})`.
   */
  readonly resources?: readonly AdminResourceEntry[];
  /** Dashboard widgets: `new MetricWidget(...)`, `ChartWidget`, `TableWidget`, `ActivityWidget`. */
  readonly dashboard?: readonly DashboardWidget[];
  /** Custom sidebar pages, each made of widgets: `new AdminPage({ id, label, widgets })`. */
  readonly pages?: readonly AdminPage[];
  /** Where the audit log is stored (default: in memory). */
  readonly auditStore?: IAuditStore;
  /**
   * Where admin sessions, login lockouts and the built-in account's 2FA live. Default: the
   * `createAuth` store when `auth` is one, else memory. Use `new DatabaseAuthStore({ connection })`
   * when you run several instances or want them to survive restarts.
   */
  readonly store?: AuthStore;
  /**
   * Who can do what. Superusers and users with the `admin` role can do everything; `staff` users
   * need permissions like `admin.<resource>.view|add|change|delete|export`, `admin.media.*`,
   * `admin.audit.view`. `requireSuperuser: true` admits superusers only; `authorizationManager`
   * adds your own (object-level) policies.
   */
  readonly permissions?: AdminAuthOptions;
  /** Extra checks on the System page; the database is checked automatically. */
  readonly healthChecks?: Readonly<Record<string, () => unknown>>;
  /** Lifetime of an admin login in seconds. Default 8 hours. */
  readonly sessionTtlSeconds?: number;
  /** Extra CSS injected into the admin page (brand colors, fonts). */
  readonly customCss?: string;
  /** "View site" link. Default '/'. */
  readonly siteUrl?: string;
  /** Logo image (https URL, path served by your app, or data:image URL). Square works best. */
  readonly logoUrl?: string;
  /** Letters in the logo badge when there is no logoUrl. Default: the title's initials. */
  readonly logoText?: string;
  /** Browser tab icon. Defaults to logoUrl. */
  readonly faviconUrl?: string;
  /**
   * Media disks for the admin media library, by name: `new LocalDiskMediaStorage(...)`,
   * `new S3MediaStorage(...)` (S3, R2, MinIO, Spaces) or an `AdminMediaManager` with upload
   * rules. The first disk receives form uploads. Default: `{ local: new LocalDiskMediaStorage() }`
   * (`./uploads`, served at `/media`). Pass `{}` to disable.
   */
  readonly media?: Readonly<Record<string, IMediaStorage | AdminMediaManager>>;
}

export interface AdminCredentials {
  readonly username?: string;
  readonly email?: string;
  readonly password?: string;
  readonly name?: string;
}

export type AdminResourceEntry =
  | DefinedModelStatic<any, any>
  | Model
  | AdminResource
  | (AdminResourceOptions & { readonly model: DefinedModelStatic<any, any> });

export interface OpenApiOptions {
  readonly path?: string;
  /** Swagger UI page. Default `/docs`. */
  readonly docsPath?: string;
  /**
   * Middleware for the spec and the docs page, e.g. `[auth.required({ roles: ['admin'] })]` for an
   * internal API. Default: public. Admin routes are never listed.
   */
  readonly middleware?: readonly RouteArg[];
  readonly title?: string;
  readonly version?: string;
  readonly description?: string;
}

/**
 * Arguments of `app.get/post/...`: middleware (`validate(...)`, `auth.required()`, ...), route
 * options, and the handler last. `ctx` is typed as RequestContext (`ctx.params`, `ctx.query`,
 * `ctx.body`, `ctx.request`).
 */
export type RouteArg =
  ((ctx: RequestContext, next: () => Promise<HttpResponse>) => unknown) | RouteOptions;

function parseRouteArgs(args: readonly RouteArg[]): {
  handler: RouteHandler;
  options: RouteOptions;
} {
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

  const existingMw = options.middleware
    ? Array.isArray(options.middleware)
      ? options.middleware
      : [options.middleware]
    : [];
  options.middleware = [...existingMw, ...middlewares];

  return { handler, options };
}

export class JSangoApplication {
  public readonly app: MiddlewareApplication;
  private readonly wsManager = new WebSocketEndpointManager();
  private readonly openapiRegistry = new OpenApiRegistry();
  private isProduction: boolean;

  constructor(options: ApplicationOptions = {}) {
    this.isProduction = options.isProduction ?? isProductionEnv();
    this.app = new MiddlewareApplication({
      ...options,
      isProduction: this.isProduction,
      // Without a logger, 500s would vanish. Tests stay quiet.
      logger:
        options.logger ??
        (process.env['NODE_ENV'] === 'test'
          ? undefined
          : new StructuredLogger({
              minLevel: 'warn',
              format: this.isProduction ? 'json' : 'text',
            })),
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

  public get(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.get(path, handler, options);
    return this;
  }

  public post(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.post(path, handler, options);
    return this;
  }

  public put(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.put(path, handler, options);
    return this;
  }

  public patch(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.patch(path, handler, options);
    return this;
  }

  public delete(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.delete(path, handler, options);
    return this;
  }

  public head(path: string, ...handlers: RouteArg[]): this {
    const { handler, options } = parseRouteArgs(handlers);
    this.app.head(path, handler, options);
    return this;
  }

  public options(path: string, ...handlers: RouteArg[]): this {
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

  /**
   * WebSocket route. Middleware (e.g. `auth.required()`) runs on the upgrade request, like on HTTP
   * routes: `app.ws('/chat/:room', auth.required(), { open, message, close })`.
   */
  public ws(path: string, ...args: [...RouteArg[], WebSocketRouteCallback]): this {
    const callback = args.pop() as WebSocketRouteCallback;
    const middleware = args.filter((a) => typeof a === 'function') as never[];
    this.wsManager.register(path, middleware, callback);
    return this;
  }

  /**
   * Sends to every WebSocket in a room, from anywhere (HTTP routes, jobs, events). Each socket is
   * in `user:<id>` when signed in and `route:<path>` for its route.
   */
  public to(room: string): RoomSender {
    return {
      send: (data) => this.wsManager.sendTo(room, data),
      emit: (event, data) => this.wsManager.sendTo(room, { event, data }),
    };
  }

  // --- CRUD Generation ---

  public crud(
    basePath: string,
    modelClass: DefinedModelStatic<any, any>,
    options: CrudOptions = {}
  ): this {
    const rootPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    const idPath = `${rootPath}/:id`;
    const defaultPageSize = options.defaultPageSize ?? 20;
    const meta = modelClass.metadata;
    const fieldNames = [...meta.fields.keys()];

    // `hidden` adds to the sensitive defaults: hiding one field must not reveal the password.
    const hidden = new Set([
      ...fieldNames.filter((f) => SENSITIVE_FIELD.test(f)),
      ...(options.hidden ?? []),
    ]);
    const readOnly = new Set([
      meta.primaryKey,
      ...hidden,
      ...fieldNames.filter((f) => PRIVILEGE_FIELD.test(f)),
    ]);
    if (meta.timestamps.enabled)
      readOnly.add(meta.timestamps.createdAt).add(meta.timestamps.updatedAt);
    if (meta.softDelete.enabled) readOnly.add(meta.softDelete.deletedAt);
    const writable = new Set(options.writable ?? fieldNames.filter((f) => !readOnly.has(f)));

    const query = (ctx: RequestContext) =>
      options.scope ? options.scope(modelClass.query(), ctx) : modelClass.query();
    const output = (item: Model) => {
      const json = item.toJSON();
      for (const f of hidden) delete json[f];
      return json;
    };
    const input = async (ctx: RequestContext): Promise<CrudData> => {
      const body = await ctx.request.body.json().catch(() => ({}));
      const data: CrudData = {};
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [k, v] of Object.entries(body)) if (writable.has(k)) data[k] = v;
      }
      return data;
    };
    /** Validates `record` with the schema; returns the validated values of `data`'s keys or a 400. */
    const check = async (data: CrudData, record: CrudData): Promise<CrudData | HttpResponse> => {
      if (!options.schema) return data;
      const res = await options.schema.validate(record);
      if (!res.success) {
        return HttpResponse.json(
          {
            error: {
              code: 'ERR_VALIDATION_FAILED',
              message: 'Validation failed for incoming request.',
              details: res.errors,
            },
          },
          { status: 400 }
        );
      }
      const valid = (res.data ?? {}) as CrudData;
      return Object.fromEntries(Object.keys(data).map((k) => [k, k in valid ? valid[k] : data[k]]));
    };
    // Writes with hooks share one transaction, so a throwing hook rolls the write back.
    const atomic = <T>(fn: () => Promise<T>) =>
      options.hooks || options.scope ? transaction(fn) : fn();
    /** With a scope, a write can't create or move a record outside it (e.g. to another owner). */
    const assertInScope = async (ctx: RequestContext, item: Model) => {
      if (options.scope && !(await query(ctx).find(item.get(meta.primaryKey)))) {
        throw new ForbiddenError('This change would move the record outside what you can access.');
      }
    };

    const access = options.access;
    const route = (
      op: CrudOperation,
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      path: string,
      handler: RouteHandler
    ) => {
      if (options.only && !options.only.includes(op)) return;
      const group = op === 'list' || op === 'detail' ? 'read' : 'write';
      const rule =
        typeof access === 'string' || typeof access === 'function'
          ? access
          : (access?.[op] ?? access?.[group] ?? (group === 'read' ? 'public' : undefined));
      if (!rule) {
        this[method](path, () => {
          throw new ForbiddenError(
            `${op} is not allowed on ${rootPath}. Allow it with app.crud(..., { access: { ${op}: ... } }).`
          );
        });
      } else if (rule === 'public') {
        this[method](path, handler);
      } else {
        this[method](path, rule, handler);
      }
    };

    route('list', 'get', rootPath, async (ctx: RequestContext) => {
      const page = Math.min(1_000_000, Math.max(1, intParam(ctx.request.query.get('page'), 1)));
      const pageSize = Math.min(
        options.maxPageSize ?? 100,
        Math.max(1, intParam(ctx.request.query.get('pageSize'), defaultPageSize))
      );
      const search = ctx.request.query.get('search')?.slice(0, 200);

      let q = query(ctx);

      for (const field of options.filterFields ?? []) {
        const raw = ctx.request.query.get(field);
        if (raw === null || raw === undefined) continue;
        const type = meta.getField(field)?.type;
        const value =
          raw === 'null'
            ? null
            : type === 'boolean'
              ? raw === 'true' || raw === '1'
              : type === 'integer' || type === 'float' || type === 'decimal'
                ? Number(raw)
                : raw;
        if (typeof value === 'number' && !Number.isFinite(value)) {
          throw new BadRequestError(`Invalid value for "${field}".`);
        }
        q = q.where(field, value);
      }

      const searchFields = options.searchFields ?? [];
      if (search && searchFields.length > 0) {
        // Grouped so the OR between search fields cannot bypass the filters above.
        q = q.where((w: QueryBuilder<any>) =>
          searchFields.reduce((acc, field) => acc.orWhereContains(field, search), w)
        );
      }

      const result = await q.paginate({ page, pageSize });
      return { ...result, items: result.items.map((item) => output(item as Model)) };
    });

    route('detail', 'get', idPath, async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = await query(ctx).find(id);
      if (!item) return HttpResponse.notFound(`Item with id "${id}" not found.`);
      return output(item as Model);
    });

    route('create', 'post', rootPath, async (ctx: RequestContext) => {
      const data = await input(ctx);
      const valid = await check(data, data);
      if (valid instanceof HttpResponse) return valid;
      const item = await atomic(async () => {
        const final = (await options.hooks?.beforeCreate?.(valid, ctx)) ?? valid;
        const created = (await modelClass.create(final as any)) as Model;
        await assertInScope(ctx, created);
        await options.hooks?.afterCreate?.(created, ctx);
        return created;
      });
      return HttpResponse.created(output(item));
    });

    const updateHandler: RouteHandler = async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = (await query(ctx).find(id)) as Model | null;
      if (!item) return HttpResponse.notFound(`Item with id "${id}" not found.`);
      const data = await input(ctx);
      const valid = await check(data, { ...item.toJSON(), ...data });
      if (valid instanceof HttpResponse) return valid;
      await atomic(async () => {
        const final = (await options.hooks?.beforeUpdate?.(valid, item, ctx)) ?? valid;
        for (const [key, val] of Object.entries(final)) item.set(key, val);
        await item.save();
        await assertInScope(ctx, item);
        await options.hooks?.afterUpdate?.(item, ctx);
      });
      return output(item);
    };
    route('update', 'put', idPath, updateHandler);
    route('update', 'patch', idPath, updateHandler);

    route('delete', 'delete', idPath, async (ctx: RequestContext) => {
      const id = ctx.request.params['id'];
      const item = (await query(ctx).find(id)) as Model | null;
      if (!item) return HttpResponse.notFound(`Item with id "${id}" not found.`);
      await atomic(async () => {
        await options.hooks?.beforeDelete?.(item, ctx);
        await item.delete();
        await options.hooks?.afterDelete?.(item, ctx);
      });
      return HttpResponse.noContent();
    });

    return this;
  }

  // --- Automatic Admin Mounting ---

  public admin(options: AdminOptions = {}): this {
    const rawPath = options.path ?? options.prefix ?? '/admin';
    const uiPath = rawPath.startsWith('/')
      ? rawPath.replace(/\/$/, '')
      : `/${rawPath.replace(/\/$/, '')}`;
    const apiPrefix = options.apiPrefix ?? `${uiPath}/api/v1`;
    const registry = new AdminRegistry();
    for (const entry of options.resources ?? []) {
      if (entry instanceof AdminResource) {
        // A resource declared by model name gets the model's fields (overridable by `fields`).
        const model = entry.options.modelMetadata
          ? undefined
          : defaultModelRegistry.getModel(entry.modelName);
        registry.register(
          model ? new AdminResource({ ...entry.options, modelMetadata: model.metadata }) : entry
        );
      } else if (typeof entry === 'function') {
        registry.register(entry as any);
      } else {
        const { model, ...resourceOptions } = entry as AdminResourceOptions & {
          model: DefinedModelStatic<any, any>;
        };
        registry.register(model as any, resourceOptions);
      }
    }
    for (const widget of options.dashboard ?? []) registry.dashboard.registerWidget(widget);
    for (const page of options.pages ?? []) registry.registerPage(page);

    const permissions = new AdminPermissionChecker(options.permissions);
    if (isProductionEnv() && !options.auditStore) {
      process.emitWarning(
        'app.admin() keeps the audit log in memory: it is lost on restart. Pass auditStore.',
        { code: 'JSANGO_MEMORY_AUDIT' }
      );
    }
    if (isProductionEnv() && !options.store && !(options.auth instanceof Auth)) {
      process.emitWarning(
        'app.admin() keeps sessions and 2FA in memory: single instance only, reset on restart. Pass store: new DatabaseAuthStore(...).',
        { code: 'JSANGO_MEMORY_ADMIN_STORE' }
      );
    }
    const audit = new AdminAuditLogger({ store: options.auditStore ?? new InMemoryAuditStore() });
    const queryAdapter = createOrmAdminAdapter();
    const authKit = options.auth instanceof Auth ? options.auth : undefined;

    const healthChecks: Record<string, () => unknown> = {};
    if (hasDatabaseManager()) {
      healthChecks['database'] = async () => {
        const results = await getDatabaseManager().health();
        const failed = results.find((r) => r.status !== 'healthy');
        if (failed) throw new Error(`${failed.connectionName}: ${failed.error ?? 'unreachable'}`);
        return results.map((r) => `${r.connectionName}: ${r.latencyMs} ms`).join(', ');
      };
    }
    Object.assign(healthChecks, options.healthChecks);

    const media: Record<string, AdminMediaManager> = {};
    for (const [name, disk] of Object.entries(
      options.media ?? { local: new LocalDiskMediaStorage() }
    )) {
      media[name] =
        disk instanceof AdminMediaManager ? disk : new AdminMediaManager({ storage: disk });
      // Local disks with a path URL are served by the app.
      const driver = media[name].driver;
      if (driver instanceof LocalDiskMediaStorage && driver.publicUrl.startsWith('/')) {
        this.get(
          `${driver.publicUrl}/*mediaKey`,
          { metadata: { admin: true } },
          async (ctx: RequestContext) => {
            const key = (ctx.request.params as Record<string, string>)['mediaKey'] ?? '';
            const file = await driver.read(decodeURIComponent(key));
            if (!file) return HttpResponse.notFound();
            return new HttpResponse(file.content, {
              headers: {
                'content-type': file.mimeType,
                'x-content-type-options': 'nosniff',
                // Uploaded HTML/SVG must not run scripts on the app's origin.
                'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
                'cache-control': 'public, max-age=86400',
              },
            });
          }
        );
      }
    }

    const adminServer = new AdminServer({
      registry,
      permissions,
      audit,
      queryAdapter,
      prefix: apiPrefix,
      authKit,
      credentials:
        options.credentials ??
        (authKit ? undefined : (options.auth as AdminCredentials | undefined)),
      sessionTtlSeconds: options.sessionTtlSeconds,
      healthChecks,
      media,
      store: options.store,
    });

    adminServer.mount(this.app.router);

    // Mount the React Chakra UI SPA at the configured UI path
    const uiHandler = createAdminUiHandler({
      title: options.title,
      apiBasePath: apiPrefix,
      defaultTheme: options.defaultTheme,
      brandSubtitle: options.brandSubtitle,
      customCss: options.customCss,
      siteUrl: options.siteUrl,
      logoUrl: options.logoUrl,
      logoText: options.logoText,
      faviconUrl: options.faviconUrl,
    });

    const hidden = { metadata: { admin: true } }; // not part of the public OpenAPI spec
    this.get(uiPath, hidden, uiHandler);
    this.get(`${uiPath}/*adminPath`, hidden, uiHandler);

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

    const middleware = [...(options.middleware ?? []), { metadata: { openapi: { hidden: true } } }];
    this.get(openapiPath, ...middleware, () => {
      return generator.generate(this.app.router);
    });

    // Swagger UI documentation page with high-contrast modern theme
    const title = escapeHtml(options.title ?? 'JSango API Documentation');
    this.get(options.docsPath ?? '/docs', ...middleware, () => {
      return HttpResponse.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
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
      <span class="brand-title">${title}</span>
    </div>
    <a href="${openapiPath}" target="_blank" class="spec-link">
      <span>Raw OpenAPI JSON ↗</span>
    </a>
  </header>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
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
   * Mounts an AI agent over HTTP: `POST path` with `{ input, conversationId? }` returns the result,
   * `GET path?input=...` (with `Accept: text/event-stream` or `&stream=true`) streams events (SSE).
   * Add auth / rate limits with `middleware`, e.g. `{ middleware: [auth.required()] }`.
   */
  public agent(path: string, targetAgent: Agent, options: AgentRouteOptions = {}): this {
    const maxInput = options.maxInputLength ?? 10_000;
    const prepare = (ctx: RequestContext, raw: { input?: unknown; conversationId?: unknown }) => {
      const input = String(raw.input ?? '');
      if (!input) throw new BadRequestError('"input" is required.');
      if (input.length > maxInput)
        throw new BadRequestError(`"input" is longer than ${maxInput} characters.`);
      const identity = getIdentity(ctx);
      const user = identity.isAuthenticated ? identity : undefined;
      // Anonymous conversations get a server-issued, unguessable id (a client-picked one could
      // collide with another visitor's).
      const conversationId =
        typeof raw.conversationId === 'string' && (user || raw.conversationId.length >= 20)
          ? raw.conversationId
          : randomUUID();
      return {
        input,
        conversationId,
        run: {
          input,
          maxSteps: options.maxSteps,
          signal: ctx.signal, // client gone: stop calling the model
          context: {
            user,
            tenantId: user?.tenantId,
            conversationId,
            requestId: ctx.requestId,
            signal: ctx.signal,
          },
        },
      };
    };
    const middleware = options.middleware ?? [];

    this.post(path, ...middleware, async (ctx: RequestContext) => {
      const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
      const { conversationId, run } = prepare(ctx, {
        input: body['input'] ?? body['message'],
        conversationId: body['conversationId'] ?? body['sessionId'],
      });
      return publicResult(await targetAgent.run(run), conversationId);
    });

    this.get(path, ...middleware, async (ctx: RequestContext) => {
      const query = ctx.request.query;
      const { conversationId, run } = prepare(ctx, {
        input: query.get('input') ?? query.get('q'),
        conversationId: query.get('conversationId'),
      });
      const wantsStream =
        query.get('stream') === 'true' ||
        Boolean(ctx.request.headers.get('accept')?.includes('text/event-stream'));
      if (!wantsStream) return publicResult(await targetAgent.run(run), conversationId);

      const encoder = new TextEncoder();
      const isProduction = this.isProduction;
      const events = targetAgent.stream(run)[Symbol.asyncIterator]();
      const readable = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await events.next();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            const event = value as { type: string; data?: unknown };
            const safe =
              event.type === 'run.failed' && isProduction
                ? { type: 'run.failed', data: { error: 'The agent run failed.' } }
                : event;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(safe)}\n\n`));
          } catch {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'run.failed' })}\n\n`)
            );
            controller.close();
          }
        },
        async cancel() {
          await events.return?.(); // client disconnected: stop the run
        },
      });
      return new HttpResponse(readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Conversation-Id': conversationId,
        },
      });
    });

    return this;
  }

  /**
   * Mounts an AI agent as a WebSocket endpoint: each message `{ input }` (or a string) starts a run
   * and its events are streamed back. One run at a time per connection.
   */
  public wsAgent(path: string, targetAgent: Agent, options: AgentRouteOptions = {}): this {
    const maxInput = options.maxInputLength ?? 10_000;
    return this.ws(path, ...(options.middleware ?? []), (socket: ISimpleWebSocket) => {
      let running: AbortController | undefined;
      socket.on('close', () => running?.abort());
      socket.on('message', async (data: any) => {
        // One run at a time per connection: a client can't start unlimited parallel LLM calls.
        if (running)
          return socket.send({ type: 'run.failed', error: 'A run is already in progress.' });
        const input = typeof data === 'string' ? data : String(data?.input ?? data?.text ?? '');
        if (!input || input.length > maxInput)
          return socket.send({ type: 'run.failed', error: 'Invalid or too long input.' });
        running = new AbortController();
        try {
          await socket.send({ type: 'run.started', agent: targetAgent.name, input });
          for await (const event of targetAgent.stream({
            input,
            maxSteps: options.maxSteps,
            signal: running.signal,
            context: {
              user: socket.user,
              tenantId: socket.user?.tenantId,
              conversationId: socket.id,
              requestId: `ws_${socket.id}_${Date.now()}`,
              signal: running.signal,
            },
          })) {
            await socket.send(event);
          }
        } catch (err: unknown) {
          await socket.send({
            type: 'run.failed',
            error: this.isProduction
              ? 'The agent run failed.'
              : err instanceof Error
                ? err.message
                : String(err),
          });
        } finally {
          running = undefined;
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
      trustProxy: this.app.config.trustProxy,
      maxBodySize: this.app.config.maxBodySize,
      onUpgrade: this.wsManager.hasRoutes()
        ? (ctx, req, socket, head) =>
            this.wsManager.handleUpgrade(ctx, req, socket, head, {
              logger: this.app.logger,
              isProduction: this.isProduction,
            })
        : undefined,
    });

    await server.listen(port, host);

    // Closing the server also closes open WebSockets (they no longer belong to the HTTP server).
    const closeHttp = server.close.bind(server);
    server.close = async (timeoutMs?: number) => {
      await this.wsManager.close();
      await closeHttp(timeoutMs);
    };

    if (!this.isProduction && process.env['NODE_ENV'] !== 'test') {
      /* eslint-disable no-console */
      console.log(`\n  ⚡ JSango Server running at http://${host}:${port}`);
      const wsRoutes = this.wsManager.getRoutes();
      if (wsRoutes.length > 0) {
        console.log(`  🔌 WebSocket routes: ${wsRoutes.join(', ')}`);
      }
      console.log('');
      /* eslint-enable no-console */
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

/**
 * Admin data access through the ORM. Built for large tables: only list columns are loaded,
 * pages are sorted with a primary-key tie-breaker (stable paging), exports stream with keyset
 * pagination, and bulk deletes run as one query.
 */
function createOrmAdminAdapter(): IAdminQueryAdapter {
  const model = (name: string) => {
    const m = defaultModelRegistry.getModel(name);
    if (!m) throw new Error(`Model "${name}" is not registered.`);
    return m;
  };
  const row = (item: any): Record<string, unknown> =>
    item.toJSON ? item.toJSON() : item.getAttributes();
  // ponytail: search is a case-insensitive LIKE '%text%' (a scan on huge tables); index the
  // columns or point searchFields at indexed/full-text columns when this gets slow.
  const filtered = (
    name: string,
    query: AdminListQuery,
    searchFields: readonly string[],
    columns?: readonly string[]
  ) => {
    let q: any = model(name).query();
    const search = query.search;
    if (search && searchFields.length > 0) {
      q = q.where((g: any) =>
        searchFields.reduce(
          (acc: any, f, i) =>
            i === 0 ? acc.whereContains(f, search) : acc.orWhereContains(f, search),
          g
        )
      );
    }
    for (const [field, value] of Object.entries(query.filters ?? {})) q = q.where(field, value);
    return columns?.length ? q.select(...columns) : q;
  };

  return {
    async list(opts) {
      const page = opts.query.page ?? 1;
      const pageSize = opts.query.pageSize ?? opts.pageSize;
      const sort = opts.query.sort ?? opts.defaultSortField;
      let q = filtered(opts.modelName, opts.query, opts.searchFields, opts.columns).orderBy(
        sort,
        (opts.query.sortDirection ?? opts.defaultSortDirection).toUpperCase()
      );
      if (sort !== opts.primaryKey) q = q.orderBy(opts.primaryKey, 'ASC');

      if (opts.exactCount === false) {
        const items = await q
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize)
          .get();
        return {
          items: items.slice(0, pageSize).map(row),
          total: null,
          page,
          pageSize,
          totalPages: null,
          hasMore: items.length > pageSize,
        };
      }
      const res = await q.paginate({ page, pageSize });
      return {
        items: res.items.map(row),
        total: res.total,
        page,
        pageSize,
        totalPages: res.totalPages,
        hasMore: page < res.totalPages,
      };
    },
    async *stream(opts) {
      let batch: Record<string, unknown>[] = [];
      for await (const item of filtered(
        opts.modelName,
        opts.query,
        opts.searchFields,
        opts.columns
      ).cursor(opts.batchSize)) {
        batch.push(row(item));
        if (batch.length >= opts.batchSize) {
          yield batch;
          batch = [];
        }
      }
      if (batch.length > 0) yield batch;
    },
    async findById(opts) {
      const found = await model(opts.modelName).find(opts.id);
      return found ? row(found) : null;
    },
    async findMany(opts) {
      return (await model(opts.modelName).query().whereIn(opts.primaryKey, opts.ids).get()).map(
        row
      );
    },
    async create(opts) {
      return row(await model(opts.modelName).create(opts.data as any));
    },
    async update(opts) {
      const item: any = await model(opts.modelName).findOrFail(opts.id);
      for (const [k, v] of Object.entries(opts.data)) item.set(k, v);
      await item.save();
      return row(item);
    },
    async delete(opts) {
      const item: any = await model(opts.modelName).find(opts.id);
      if (item) await item.delete({ force: !opts.soft });
    },
    async deleteMany(opts) {
      return model(opts.modelName)
        .query()
        .whereIn(opts.primaryKey, opts.ids)
        .delete({ force: !opts.soft });
    },
    async restore(opts) {
      const m: any = model(opts.modelName);
      await m.query().withTrashed().where(opts.primaryKey, opts.id).restore();
      return row(await m.findOrFail(opts.id));
    },
  };
}
