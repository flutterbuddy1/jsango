import * as crypto from 'node:crypto';
import { isProductionEnv } from '@jsango/core';
import type { IRouter, RouteHandler } from '@jsango/router';
import type { HttpRequest, RequestContext } from '@jsango/http';
import { HttpError, HttpResponse, HttpStatus } from '@jsango/http';
import {
  type Identity,
  type Auth,
  type AuthStore,
  MemoryAuthStore,
  UserIdentity,
  TotpService,
  TooManyAttemptsError,
} from '@jsango/auth';
import type { AdminRegistry, AdminResource } from '@jsango/admin-core';
import {
  ActivityWidget,
  AdminAuthorizationError,
  AdminDashboard,
  AdminItemNotFoundError,
  AdminResourceNotFoundError,
  AdminActionError,
  AdminValidationError,
} from '@jsango/admin-core';
import type { AdminPermissionChecker } from '@jsango/admin-auth';
import type { AdminAuditLogger } from '@jsango/admin-audit';
import { mimeFromName, type AdminMediaManager } from '@jsango/admin-media';
import { AdminCrudService } from './crud-service.js';
import { parseListQuery, sendJson, sendError } from './http-helpers.js';
import type { IAdminQueryAdapter } from './types.js';

export interface AdminCredentialsOptions {
  /** Super admin username. Default `JSANGO_ADMIN_USER` or the part before @ of the email. */
  readonly username?: string | undefined;
  /** Super admin email. Default `JSANGO_ADMIN_EMAIL` or 'admin@jsango.dev'. */
  readonly email?: string | undefined;
  /**
   * Super admin password. Default `JSANGO_ADMIN_PASSWORD`. Without one, the development default
   * 'admin123' is used and login is refused in production.
   */
  readonly password?: string | undefined;
  /** Display name. */
  readonly name?: string | undefined;
}

export interface AdminServerOptions {
  readonly registry: AdminRegistry;
  readonly queryAdapter: IAdminQueryAdapter;
  readonly permissions: AdminPermissionChecker;
  readonly audit: AdminAuditLogger;
  /** URL prefix for all admin API routes. Default '/admin/api/v1'. */
  readonly prefix?: string | undefined;
  /** The built-in super admin account (used when `authKit` is not set). */
  readonly credentials?: AdminCredentialsOptions | undefined;
  /** Alias for credentials. */
  readonly auth?: AdminCredentialsOptions | undefined;
  /**
   * Sign in to the admin with your application's users (`createAuth()`): passwords, lockout and
   * two-factor login come from your auth setup. Users need the `admin`/`staff` role, the
   * `admin.access` permission or `isSuperuser` to enter.
   */
  readonly authKit?: Auth<any> | undefined;
  /** Lifetime of an admin login. Default 8 hours. */
  readonly sessionTtlSeconds?: number | undefined;
  /** Extra checks shown on the System page, e.g. `{ redis: () => redis.ping() }`. */
  readonly healthChecks?: Readonly<Record<string, () => unknown>> | undefined;
  /** Media disks shown in the admin media library, e.g. `{ local: new AdminMediaManager(...) }`. */
  readonly media?: Readonly<Record<string, AdminMediaManager>> | undefined;
  /**
   * Where admin sessions, login lockouts, export links and the built-in account's 2FA and password
   * live. Default: the `authKit`'s store, else memory (single instance; lost on restart). Use
   * `new DatabaseAuthStore({ connection: db })` to share them between instances.
   */
  readonly store?: AuthStore | undefined;
  /** Resolves the identity for requests that don't carry an admin session token. */
  readonly resolveIdentity?:
    ((req: HttpRequest) => Promise<Identity | undefined> | Identity | undefined) | undefined;
}

interface AdminSession {
  readonly id: string;
  readonly userId: string;
  readonly profile: { readonly email: string; readonly name: string };
  readonly createdAt: number;
  lastActive: number;
  readonly device: string;
  readonly ip: string;
}

const FOREVER = 10 * 365 * 24 * 3600; // store TTL for settings that don't expire
const IDLE_MS = 60 * 60 * 1000; // a session unused for an hour ends
const RECHECK_MS = 60 * 1000; // how often app users' roles / bans are re-read

const DEFAULT_PASSWORD = 'admin123';
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const safeEqual = (a: string, b: string) =>
  crypto.timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b)));

/**
 * Registers the Admin HTTP API on a router (relative to the prefix):
 *
 *   POST   /auth/login | /auth/logout            GET /auth/me | /auth/profile
 *   POST   /auth/password | /auth/2fa/{setup,verify,disable}
 *   GET    /auth/sessions                        DELETE /auth/sessions/:id
 *   GET    /dashboard | /dashboard/widgets/:widgetId
 *   GET    /pages | /pages/:pageId | /pages/:pageId/widgets/:widgetId
 *   GET    /system/health
 *   GET    /resources | /resources/:resourceId/schema
 *   POST   /resources/:resourceId/export (one-time URL) → GET .../export?ticket= (CSV stream)
 *   GET    /resources/:resourceId                POST /resources/:resourceId
 *   GET    /resources/:resourceId/:id            PATCH | DELETE /resources/:resourceId/:id
 *   POST   /resources/:resourceId/:id/restore    POST /resources/:resourceId/:id/actions/:actionId
 *   POST   /resources/:resourceId/bulk/:actionId (built-in: `delete`)
 *   GET    /audit
 *   GET    /media | /media/:disk?prefix=        POST /media/:disk (raw body, x-file-name header)
 *   DELETE /media/:disk?key=
 */
export class AdminServer {
  private readonly registry: AdminRegistry;
  private readonly crud: AdminCrudService;
  private readonly permissions: AdminPermissionChecker;
  private readonly audit: AdminAuditLogger;
  private readonly prefix: string;
  private readonly authKit: Auth<any> | undefined;
  private readonly resolver: AdminServerOptions['resolveIdentity'];
  private readonly sessionTtlMs: number;
  private readonly healthChecks: Readonly<Record<string, () => unknown>>;
  private readonly media: Readonly<Record<string, AdminMediaManager>>;
  private readonly totp = new TotpService();
  private readonly adminEmail: string;
  private readonly adminUsername: string;
  private readonly adminPassword: string;
  private readonly passwordConfigured: boolean;
  private readonly adminName: string;
  /** Sessions are keyed by sha256(token): a leaked store doesn't reveal usable tokens. */
  private readonly store: AuthStore;
  /** Per-instance cache of app users' identities, re-read every RECHECK_MS. */
  private readonly identities = new Map<string, { identity: Identity; checkedAt: number }>();
  private readonly fallbackDashboard: AdminDashboard;

  constructor(options: AdminServerOptions) {
    this.registry = options.registry;
    this.permissions = options.permissions;
    this.audit = options.audit;
    this.prefix = options.prefix ?? '/admin/api/v1';
    this.authKit = options.authKit;
    this.resolver = options.resolveIdentity;
    this.sessionTtlMs = (options.sessionTtlSeconds ?? 8 * 3600) * 1000;
    this.healthChecks = options.healthChecks ?? {};
    this.media = options.media ?? {};
    this.store = options.store ?? options.authKit?.store ?? new MemoryAuthStore();

    const creds = options.credentials ?? options.auth;
    const env = process.env;
    this.adminEmail =
      creds?.email ?? env['JSANGO_ADMIN_EMAIL'] ?? env['ADMIN_EMAIL'] ?? 'admin@jsango.dev';
    this.adminUsername =
      creds?.username ??
      env['JSANGO_ADMIN_USER'] ??
      env['ADMIN_USERNAME'] ??
      this.adminEmail.split('@')[0]!;
    const password = creds?.password ?? env['JSANGO_ADMIN_PASSWORD'] ?? env['ADMIN_PASSWORD'];
    this.passwordConfigured = Boolean(password);
    this.adminPassword = password ?? DEFAULT_PASSWORD;
    this.adminName = creds?.name ?? 'System Administrator';

    this.crud = new AdminCrudService({
      queryAdapter: options.queryAdapter,
      permissions: options.permissions,
      audit: options.audit,
    });

    // Shown when the app registers no dashboard widgets: real recent admin activity.
    this.fallbackDashboard = new AdminDashboard([
      new ActivityWidget({
        id: 'recent-activity',
        title: 'Recent admin activity',
        width: 'full',
        getActivity: async () => {
          const page = await this.audit.query({ limit: 10, offset: 0 });
          return page.entries.map((e) => ({
            id: e.id,
            title: `${e.actor?.email ?? e.actor?.username ?? e.actor?.id ?? 'system'} ${e.action.replace('_', ' ')} ${e.resourceLabel ?? e.resourceId}${e.objectRepresentation ? ` "${e.objectRepresentation}"` : ''}`,
            subtitle: e.ipAddress,
            timestamp: e.timestamp.getTime(),
            icon: e.action,
          }));
        },
      }),
    ]);
  }

  public mount(appRouter: IRouter): void {
    const p = this.prefix;
    // Admin routes are tagged so the public OpenAPI spec leaves them out, wherever they're mounted.
    const admin = { metadata: { admin: true } };
    const router = {
      get: (path: string, h: RouteHandler) => appRouter.get(path, h, admin),
      post: (path: string, h: RouteHandler) => appRouter.post(path, h, admin),
      patch: (path: string, h: RouteHandler) => appRouter.patch(path, h, admin),
      delete: (path: string, h: RouteHandler) => appRouter.delete(path, h, admin),
    } as IRouter;

    router.post(
      `${p}/auth/login`,
      this.route((ctx) => this.login(ctx))
    );
    router.post(
      `${p}/auth/logout`,
      this.route((ctx) => this.logout(ctx))
    );
    router.get(
      `${p}/auth/me`,
      this.authed((_ctx, identity) => this.me(identity))
    );
    router.get(
      `${p}/auth/profile`,
      this.authed((_ctx, identity) => this.profile(identity))
    );
    router.post(
      `${p}/auth/password`,
      this.authed((ctx, identity) => this.changePassword(ctx, identity))
    );
    router.post(
      `${p}/auth/2fa/setup`,
      this.authed((_ctx, identity) => this.setup2fa(identity))
    );
    router.post(
      `${p}/auth/2fa/verify`,
      this.authed((ctx, identity) => this.verify2fa(ctx, identity))
    );
    router.post(
      `${p}/auth/2fa/disable`,
      this.authed((ctx, identity) => this.disable2fa(ctx, identity))
    );
    router.get(
      `${p}/auth/sessions`,
      this.authed((ctx, identity) => this.listSessions(ctx, identity))
    );
    router.delete(
      `${p}/auth/sessions/:sessionId`,
      this.authed((ctx, identity) => this.deleteSession(ctx, identity))
    );
    router.post(
      `${p}/auth/sessions/terminate-others`,
      this.authed((ctx, identity) => this.terminateOthers(ctx, identity))
    );

    router.get(
      `${p}/dashboard`,
      this.admin((_ctx, identity) => sendJson(this.boardJson(this.dashboard(identity), identity)))
    );
    router.get(
      `${p}/dashboard/widgets/:widgetId`,
      this.admin((ctx, identity) => this.widgetData(ctx, this.dashboard(identity), identity))
    );
    router.get(
      `${p}/pages`,
      this.admin((_ctx, identity) =>
        sendJson({ pages: this.visiblePages(identity).map((pg) => pg.toJSON()) })
      )
    );
    router.get(
      `${p}/pages/:pageId`,
      this.admin((ctx, identity) => {
        const page = this.page(ctx, identity);
        return sendJson({ page: page.toJSON(), ...this.boardJson(page.dashboard, identity) });
      })
    );
    router.get(
      `${p}/pages/:pageId/widgets/:widgetId`,
      this.admin((ctx, identity) =>
        this.widgetData(ctx, this.page(ctx, identity).dashboard, identity)
      )
    );
    router.get(
      `${p}/system/health`,
      this.admin(() => this.health())
    );

    router.get(
      `${p}/resources`,
      this.admin((_ctx, identity) => this.listResources(identity))
    );
    router.get(
      `${p}/resources/:resourceId/schema`,
      this.resource((_ctx, r, identity) => sendJson({ schema: this.schemaFor(r, identity) }))
    );
    // Export: POST returns a one-time download URL (valid 60s), so the browser can stream the
    // file natively without putting the session token in a URL.
    router.post(
      `${p}/resources/:resourceId/export`,
      this.resource(async (ctx, r, identity) => {
        if (!(await this.permissions.canExport(identity, r))) {
          throw new AdminAuthorizationError({ resource: r.id, action: 'export' });
        }
        const ticket = crypto.randomBytes(24).toString('base64url');
        await this.store.set(
          `admin:t:${sha256(ticket)}`,
          JSON.stringify({ resourceId: r.id, identity: identity.toJSON() }),
          60
        );
        const params = new URLSearchParams(String((await this.body(ctx))['query'] ?? ''));
        params.set('ticket', ticket);
        return sendJson({ url: `/resources/${encodeURIComponent(r.id)}/export?${params}` });
      })
    );
    router.get(
      `${p}/resources/:resourceId/export`,
      this.route(async (ctx) => {
        const key = `admin:t:${sha256(ctx.request.query.get('ticket') ?? '')}`;
        const raw = await this.store.get(key);
        await this.store.delete(key); // one-time link
        const ticket = raw
          ? (JSON.parse(raw) as { resourceId: string; identity: Record<string, unknown> })
          : undefined;
        const resource = this.registry.getResource(this.param(ctx, 'resourceId'));
        if (!ticket || !resource || resource.id !== ticket.resourceId) {
          return sendError(
            401,
            'ERR_ADMIN_UNAUTHORIZED',
            'Download link expired. Start the export again.'
          );
        }
        return this.exportCsv(ctx, resource, identityFromJSON(ticket.identity));
      })
    );
    router.get(
      `${p}/resources/:resourceId`,
      this.resource(async (ctx, r, identity) =>
        sendJson(await this.crud.list(r, parseListQuery(ctx.request), identity))
      )
    );
    router.post(
      `${p}/resources/:resourceId`,
      this.resource(async (ctx, r, identity) =>
        sendJson(
          { item: await this.crud.create(r, await this.body(ctx), identity, this.reqContext(ctx)) },
          HttpStatus.CREATED
        )
      )
    );
    router.get(
      `${p}/resources/:resourceId/:id`,
      this.resource(async (ctx, r, identity) =>
        sendJson({ item: await this.crud.detail(r, this.param(ctx, 'id'), identity) })
      )
    );
    router.patch(
      `${p}/resources/:resourceId/:id`,
      this.resource(async (ctx, r, identity) =>
        sendJson({
          item: await this.crud.update(
            r,
            this.param(ctx, 'id'),
            await this.body(ctx),
            identity,
            this.reqContext(ctx)
          ),
        })
      )
    );
    router.delete(
      `${p}/resources/:resourceId/:id`,
      this.resource(async (ctx, r, identity) => {
        await this.crud.delete(r, this.param(ctx, 'id'), identity, this.reqContext(ctx));
        return sendJson(null, HttpStatus.NO_CONTENT);
      })
    );
    router.post(
      `${p}/resources/:resourceId/:id/restore`,
      this.resource(async (ctx, r, identity) =>
        sendJson({
          item: await this.crud.restore(r, this.param(ctx, 'id'), identity, this.reqContext(ctx)),
        })
      )
    );
    router.post(
      `${p}/resources/:resourceId/:id/actions/:actionId`,
      this.resource(async (ctx, r, identity) => {
        const input = await ctx.request.body.json<unknown>().catch(() => undefined);
        const result = await this.crud.executeAction(
          r,
          this.param(ctx, 'actionId'),
          this.param(ctx, 'id'),
          input,
          identity,
          this.reqContext(ctx)
        );
        return sendJson({ result });
      })
    );
    router.post(
      `${p}/resources/:resourceId/bulk/:actionId`,
      this.resource(async (ctx, r, identity) => {
        const body = await this.body(ctx);
        if (!Array.isArray(body['ids']))
          return sendError(400, 'ERR_ADMIN_VALIDATION', '"ids" must be an array.');
        const result = await this.crud.executeBulkAction(
          r,
          this.param(ctx, 'actionId'),
          body['ids'] as (string | number)[],
          body['input'],
          identity,
          this.reqContext(ctx)
        );
        return sendJson({ result });
      })
    );

    router.get(
      `${p}/audit`,
      this.admin(async (ctx, identity) => {
        if (!this.canViewAudit(identity))
          return sendError(403, 'ERR_ADMIN_FORBIDDEN', 'You cannot view the audit log.');
        const qs = ctx.request.query;
        const limit = Math.min(Math.max(parseInt(qs.get('limit') ?? '50', 10) || 50, 1), 200);
        return sendJson(
          await this.audit.query({
            resourceId: qs.get('resourceId') ?? undefined,
            action: (qs.get('action') as never) ?? undefined,
            actorId: qs.get('actorId') ?? undefined,
            fromDate: qs.get('fromDate') ? new Date(qs.get('fromDate')!) : undefined,
            toDate: qs.get('toDate') ? new Date(qs.get('toDate')!) : undefined,
            limit,
            offset: Math.max(parseInt(qs.get('offset') ?? '0', 10) || 0, 0),
          })
        );
      })
    );

    this.mountMedia(router, p);
  }

  /** Limited staff need `admin.media.view` / `.add` / `.delete` (or `admin.media.*`). */
  private canUseMedia(identity: Identity, action: 'view' | 'add' | 'delete'): boolean {
    return (
      this.permissions.hasFullAccess(identity) ||
      identity.hasPermission(`admin.media.${action}`) ||
      identity.hasPermission('admin.media.*') ||
      identity.hasPermission('admin.*')
    );
  }

  private mountMedia(router: IRouter, p: string): void {
    const disk = (ctx: RequestContext, identity: Identity, action: 'view' | 'add' | 'delete') => {
      if (!this.canUseMedia(identity, action))
        throw new AdminAuthorizationError({ resource: 'media', action });
      const name = this.param(ctx, 'disk');
      const manager = Object.hasOwn(this.media, name) ? this.media[name] : undefined;
      if (!manager) throw new AdminResourceNotFoundError(`media:${name}`);
      return manager;
    };
    router.get(
      `${p}/media`,
      this.admin((_ctx, identity) =>
        sendJson({
          disks: this.canUseMedia(identity, 'view')
            ? Object.keys(this.media).map((name) => ({ name }))
            : [],
        })
      )
    );
    router.get(
      `${p}/media/:disk`,
      this.admin(async (ctx, identity) =>
        sendJson({
          files: await disk(ctx, identity, 'view').list(
            ctx.request.query.get('prefix') ?? undefined
          ),
        })
      )
    );
    router.post(
      `${p}/media/:disk`,
      this.admin(async (ctx, identity) => {
        const manager = disk(ctx, identity, 'add');
        const rawName = ctx.request.headers.get('x-file-name') ?? 'file';
        let originalName = rawName;
        try {
          originalName = decodeURIComponent(rawName);
        } catch {
          // not percent-encoded: use as sent
        }
        try {
          const file = await manager.upload({
            content: await ctx.request.body.bytes(),
            originalName,
            // From the file extension, never the client's Content-Type: a `.png` sent as
            // text/html must not be stored (and later served) as a web page.
            mimeType: mimeFromName(originalName),
            prefix: ctx.request.query.get('prefix') ?? undefined,
          });
          return sendJson({ file }, HttpStatus.CREATED);
        } catch (err) {
          if ((err as { code?: string }).code === 'ERR_ADMIN_MEDIA_VALIDATION')
            return sendError(422, 'ERR_ADMIN_VALIDATION', (err as Error).message);
          throw err;
        }
      })
    );
    router.delete(
      `${p}/media/:disk`,
      this.admin(async (ctx, identity) => {
        const manager = disk(ctx, identity, 'delete');
        const key = ctx.request.query.get('key');
        if (!key) return sendError(400, 'ERR_ADMIN_VALIDATION', '"key" is required.');
        await manager.delete(key);
        await this.audit.log('delete', {
          resourceId: 'media',
          objectId: key,
          actor: { id: identity.id },
          ...this.reqContext(ctx),
        });
        return sendJson(null, HttpStatus.NO_CONTENT);
      })
    );
  }

  // ------------------------------------------------------------------
  // Route wrappers
  // ------------------------------------------------------------------

  private route(fn: (ctx: RequestContext) => Promise<HttpResponse> | HttpResponse): RouteHandler {
    return async (ctx: RequestContext) => {
      try {
        return await fn(ctx);
      } catch (err) {
        return this.handleError(err);
      }
    };
  }

  /** Any signed-in identity. */
  private authed(
    fn: (ctx: RequestContext, identity: Identity) => Promise<HttpResponse> | HttpResponse
  ): RouteHandler {
    return this.route(async (ctx) => {
      const identity = await this.resolveIdentity(ctx);
      if (!identity) return sendError(401, 'ERR_ADMIN_UNAUTHORIZED', 'Not authenticated.');
      return fn(ctx, identity);
    });
  }

  /** Signed in and allowed into the admin. */
  private admin(
    fn: (ctx: RequestContext, identity: Identity) => Promise<HttpResponse> | HttpResponse
  ): RouteHandler {
    return this.route(async (ctx) => {
      const identity = await this.resolveIdentity(ctx);
      if (!identity) return sendError(401, 'ERR_ADMIN_UNAUTHORIZED', 'Not authenticated.');
      if (!this.permissions.canAccessAdmin(identity))
        return sendError(403, 'ERR_ADMIN_FORBIDDEN', 'Admin access denied.');
      return fn(ctx, identity);
    });
  }

  private resource(
    fn: (
      ctx: RequestContext,
      resource: AdminResource,
      identity: Identity
    ) => Promise<HttpResponse> | HttpResponse
  ): RouteHandler {
    return this.admin((ctx, identity) => {
      const id = this.param(ctx, 'resourceId');
      const resource = this.registry.getResource(id);
      if (!resource)
        return sendError(404, 'ERR_ADMIN_RESOURCE_NOT_FOUND', `Resource "${id}" not found.`);
      return fn(ctx, resource, identity);
    });
  }

  private param(ctx: RequestContext, name: string): string {
    return (ctx.request.params as Record<string, string>)[name] ?? '';
  }

  private async body(ctx: RequestContext): Promise<Record<string, unknown>> {
    const body = await ctx.request.body.json<unknown>().catch(() => undefined);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AdminValidationError({ message: 'Expected a JSON object body.', errors: [] });
    }
    return body as Record<string, unknown>;
  }

  private reqContext(ctx: RequestContext) {
    return {
      ipAddress: this.ip(ctx),
      userAgent: ctx.request.headers.get('user-agent') ?? undefined,
    };
  }

  private ip(ctx: RequestContext): string {
    // request.ip honours createApp({ trustProxy }); raw X-Forwarded-For is client-forgeable.
    return ctx.request.ip ?? 'unknown';
  }

  // ------------------------------------------------------------------
  // Identity & sessions
  // ------------------------------------------------------------------

  private bearer(ctx: RequestContext): string | undefined {
    return /^Bearer\s+(\S+)$/i.exec(ctx.request.headers.get('authorization') ?? '')?.[1];
  }

  private sessionKey(ctx: RequestContext): string | undefined {
    const token = this.bearer(ctx);
    return token ? sha256(token) : undefined;
  }

  private async readSession(key: string | undefined): Promise<AdminSession | undefined> {
    const raw = key ? await this.store.get(`admin:s:${key}`) : undefined;
    if (!raw) return undefined;
    const session = JSON.parse(raw) as AdminSession;
    if (Date.now() - session.lastActive > IDLE_MS) {
      await this.endSession(key!, session.userId);
      return undefined;
    }
    return session;
  }

  private async writeSession(key: string, session: AdminSession): Promise<void> {
    const ttl = Math.ceil((session.createdAt + this.sessionTtlMs - Date.now()) / 1000);
    if (ttl > 0) await this.store.set(`admin:s:${key}`, JSON.stringify(session), ttl);
  }

  private async endSession(key: string, userId: string): Promise<void> {
    this.identities.delete(key);
    await this.store.delete(`admin:s:${key}`);
    await this.setSessionIndex(
      userId,
      (await this.sessionIndex(userId)).filter((k) => k !== key)
    );
  }

  /** Session keys of a user (the store has no listing, so each user has an index). */
  private async sessionIndex(userId: string): Promise<string[]> {
    return JSON.parse((await this.store.get(`admin:u:${userId}`)) ?? '[]') as string[];
  }

  private async setSessionIndex(userId: string, keys: string[]): Promise<void> {
    if (keys.length === 0) await this.store.delete(`admin:u:${userId}`);
    else await this.store.set(`admin:u:${userId}`, JSON.stringify(keys), this.sessionTtlMs / 1000);
  }

  private builtInIdentity(): Identity {
    return new UserIdentity({
      id: 'admin',
      isSuperuser: true,
      roles: ['admin', 'superuser'],
      permissions: ['admin.access', 'admin.*'],
      metadata: { username: this.adminUsername, email: this.adminEmail, name: this.adminName },
    });
  }

  /**
   * The session's identity. App users are re-read every minute, so a ban, a removed admin role or
   * `auth.logoutAll()` ends their admin session too.
   */
  private async sessionIdentity(key: string, session: AdminSession): Promise<Identity | undefined> {
    if (!this.authKit) return session.userId === 'admin' ? this.builtInIdentity() : undefined;
    const cached = this.identities.get(key);
    if (cached && Date.now() - cached.checkedAt < RECHECK_MS) return cached.identity;
    const current = await this.authKit.currentIdentity(session.userId, session.createdAt);
    if (!current || !this.permissions.canAccessAdmin(current)) {
      await this.endSession(key, session.userId);
      return undefined;
    }
    const identity = withProfile(current, session.profile);
    this.identities.set(key, { identity, checkedAt: Date.now() });
    return identity;
  }

  private async resolveIdentity(ctx: RequestContext): Promise<Identity | undefined> {
    const key = this.sessionKey(ctx);
    const session = await this.readSession(key);
    if (session) {
      const identity = await this.sessionIdentity(key!, session);
      if (identity) {
        // Saved at most once a minute, not on every request.
        if (Date.now() - session.lastActive > RECHECK_MS) {
          session.lastActive = Date.now();
          await this.writeSession(key!, session);
        }
        return identity;
      }
    }
    if (this.authKit) {
      const result = await this.authKit.authenticate(ctx);
      if (result.status === 'authenticated') return result.identity;
    }
    return this.resolver ? this.resolver(ctx.request) : undefined;
  }

  private async startSession(
    ctx: RequestContext,
    identity: Identity,
    profile: AdminSession['profile']
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');
    const key = sha256(token);
    await this.writeSession(key, {
      id: crypto.randomUUID(),
      userId: identity.id,
      profile,
      createdAt: Date.now(),
      lastActive: Date.now(),
      device: parseDeviceFromUserAgent(ctx.request.headers.get('user-agent') ?? ''),
      ip: this.ip(ctx),
    });
    await this.setSessionIndex(identity.id, [...(await this.sessionIndex(identity.id)), key]);
    return token;
  }

  /** Live sessions of a user, as [key, session]; prunes expired ones from the index. */
  private async sessionsOf(userId: string): Promise<Array<[string, AdminSession]>> {
    const live: Array<[string, AdminSession]> = [];
    for (const key of await this.sessionIndex(userId)) {
      const session = await this.readSession(key);
      if (session) live.push([key, session]);
    }
    await this.setSessionIndex(
      userId,
      live.map(([k]) => k)
    );
    return live;
  }

  // ------------------------------------------------------------------
  // Login
  // ------------------------------------------------------------------

  /**
   * Lockout counters for the built-in account. Per login + IP (5): a stranger can't lock the real
   * admin out from another IP. Per login (50) and per IP (20): bounds distributed guessing.
   */
  private lockoutKeys(login: string, ip: string): Array<[string, number]> {
    const user = sha256(login.toLowerCase());
    return [
      [`admin:f:ui:${user}:${ip}`, MAX_LOGIN_FAILURES],
      [`admin:f:u:${user}`, MAX_LOGIN_FAILURES * 10],
      [`admin:f:ip:${ip}`, MAX_LOGIN_FAILURES * 4],
    ];
  }

  private async lockedOut(keys: Array<[string, number]>): Promise<boolean> {
    for (const [key, limit] of keys) {
      if (Number((await this.store.get(key)) ?? 0) >= limit) return true;
    }
    return false;
  }

  private async recordFailure(keys: Array<[string, number]>): Promise<void> {
    for (const [key] of keys) await this.store.increment(key, LOCKOUT_MS / 1000);
  }

  /** The built-in account's password: a changed one (scrypt-hashed in the store) or the env one. */
  private async adminPasswordOk(password: string): Promise<boolean> {
    const stored = await this.store.get('admin:password');
    if (!stored) return safeEqual(password, this.adminPassword);
    const [salt, hash] = stored.split(':');
    const actual = crypto.scryptSync(password, Buffer.from(salt!, 'base64'), 32);
    return crypto.timingSafeEqual(actual, Buffer.from(hash!, 'base64'));
  }

  private async twoFactorOf(): Promise<{ secret: string; backupCodes: string[] } | undefined> {
    const raw = await this.store.get('admin:2fa');
    return raw ? JSON.parse(raw) : undefined;
  }

  private async login(ctx: RequestContext): Promise<HttpResponse> {
    const body = await this.body(ctx);
    const login = String(body['email'] ?? body['username'] ?? '').trim();
    if (login.length > 254) {
      return sendError(400, 'ERR_VALIDATION', 'Email/username is too long.');
    }
    const password = String(body['password'] ?? '');
    const totpCode = typeof body['totpCode'] === 'string' ? body['totpCode'].trim() : '';
    if (!login || !password) {
      return sendError(400, 'ERR_VALIDATION', 'Please provide both email/username and password.');
    }

    let identity: Identity;
    let profile: { email: string; name: string };

    if (this.authKit) {
      try {
        let result = await this.authKit.login(login, password, ctx);
        if (result.mfaRequired) {
          if (!totpCode)
            return sendJson({
              ok: false,
              requires2fa: true,
              message: 'Enter the 6-digit code from your authenticator app.',
            });
          result = await this.authKit.verifyMfa(result.mfaToken, totpCode).catch((err: unknown) => {
            throw err instanceof TooManyAttemptsError
              ? err
              : new AdminValidationError({ message: 'Invalid two-factor code.', errors: [] });
          });
        }
        const user = result.user as Record<string, unknown>;
        identity = this.authKit.identityOf(result.user);
        profile = {
          email: String(user['email'] ?? login),
          name: String(user['name'] ?? user['username'] ?? user['email'] ?? login),
        };
      } catch (err) {
        if (err instanceof TooManyAttemptsError)
          return sendError(
            429,
            'ERR_TOO_MANY_ATTEMPTS',
            'Too many failed attempts. Try again later.'
          );
        if (err instanceof AdminValidationError)
          return sendError(400, 'ERR_INVALID_2FA', err.message);
        return sendError(401, 'ERR_INVALID_CREDENTIALS', 'Invalid email/username or password.');
      }
    } else {
      const weakDefault = !this.passwordConfigured || this.adminPassword.length < 12;
      if (weakDefault && isProductionEnv() && !(await this.store.get('admin:password'))) {
        return sendError(
          503,
          'ERR_ADMIN_NOT_CONFIGURED',
          'Admin login is disabled: set a JSANGO_ADMIN_PASSWORD of 12+ characters or use admin({ auth: createAuth(...) }).'
        );
      }
      const keys = this.lockoutKeys(login, this.ip(ctx));
      if (await this.lockedOut(keys))
        return sendError(
          429,
          'ERR_TOO_MANY_ATTEMPTS',
          'Too many failed attempts. Try again later.'
        );

      const userOk = [this.adminEmail, this.adminUsername].some(
        (u) => u.toLowerCase() === login.toLowerCase()
      );
      const passwordOk = await this.adminPasswordOk(password);
      if (!userOk || !passwordOk) {
        await this.recordFailure(keys);
        return sendError(401, 'ERR_INVALID_CREDENTIALS', 'Invalid email/username or password.');
      }

      const tfa = await this.twoFactorOf();
      if (tfa) {
        if (!totpCode)
          return sendJson({
            ok: false,
            requires2fa: true,
            message: 'Enter the 6-digit code from your authenticator app.',
          });
        const code = totpCode.replace(/\s+/g, '');
        const backup = this.totp.verifyAndConsumeBackupCode(code, tfa.backupCodes);
        const totpOk =
          this.totp.verifyToken(code, tfa.secret, { window: 1 }) &&
          !(await this.store.get(`admin:2fa-used:${code}`));
        if (!totpOk && !backup.valid) {
          await this.recordFailure(keys);
          return sendError(400, 'ERR_INVALID_2FA', 'Invalid two-factor code.');
        }
        if (backup.valid) {
          await this.store.set(
            'admin:2fa',
            JSON.stringify({ ...tfa, backupCodes: backup.remainingCodes }),
            FOREVER
          );
        } else {
          await this.store.set(`admin:2fa-used:${code}`, '1', 120); // each code works once
        }
      }
      for (const [key] of keys.slice(0, 2)) await this.store.delete(key);

      identity = this.builtInIdentity();
      profile = { email: this.adminEmail, name: this.adminName };
    }

    if (!this.permissions.canAccessAdmin(identity)) {
      return sendError(403, 'ERR_ADMIN_FORBIDDEN', 'This account does not have admin access.');
    }
    if (!(identity.metadata as Record<string, unknown> | undefined)?.['email']) {
      identity = new UserIdentity({
        id: identity.id,
        roles: [...identity.roles],
        permissions: [...identity.permissions],
        tenantId: identity.tenantId,
        isSuperuser: identity.isSuperuser,
        metadata: { ...identity.metadata, ...profile },
      });
    }

    const token = await this.startSession(ctx, identity, profile);
    await this.audit.log('login', {
      resourceId: 'auth',
      objectId: identity.id,
      actor: { id: identity.id, email: profile.email },
      ...this.reqContext(ctx),
    });
    return sendJson({
      ok: true,
      token,
      expiresIn: Math.floor(this.sessionTtlMs / 1000),
      user: {
        id: identity.id,
        email: profile.email,
        name: profile.name,
        role: identity.isSuperuser ? 'Superuser' : (identity.roles[0] ?? 'Staff'),
        isSuperuser: identity.isSuperuser,
      },
      message: 'Login successful.',
    });
  }

  private async logout(ctx: RequestContext): Promise<HttpResponse> {
    const key = this.sessionKey(ctx);
    const session = await this.readSession(key);
    if (session) {
      await this.endSession(key!, session.userId);
      await this.audit.log('logout', {
        resourceId: 'auth',
        objectId: session.userId,
        actor: { id: session.userId },
        ...this.reqContext(ctx),
      });
    }
    return sendJson({ ok: true, message: 'Logged out successfully.' });
  }

  private me(identity: Identity): HttpResponse {
    const meta = (identity.metadata ?? {}) as Record<string, unknown>;
    return sendJson({
      user: {
        id: identity.id,
        username:
          typeof meta['username'] === 'string' ? meta['username'] : (meta['email'] ?? identity.id),
        email: meta['email'],
        name: meta['name'],
        roles: identity.roles,
        permissions: identity.permissions,
        isSuperuser: identity.isSuperuser,
      },
      canAccessAdmin: this.permissions.canAccessAdmin(identity),
    });
  }

  private async profile(identity: Identity): Promise<HttpResponse> {
    const meta = (identity.metadata ?? {}) as Record<string, unknown>;
    const tfa = this.authKit ? undefined : await this.twoFactorOf();
    return sendJson({
      user: {
        id: identity.id,
        name: meta['name'] ?? identity.id,
        email: meta['email'] ?? '',
        role: identity.isSuperuser ? 'Superuser' : (identity.roles[0] ?? 'Staff'),
        isSuperuser: identity.isSuperuser,
      },
      managedByApp: Boolean(this.authKit),
      is2faEnabled: Boolean(tfa),
      hasBackupCodes: (tfa?.backupCodes.length ?? 0) > 0,
    });
  }

  /** Password and 2FA of the built-in account; app users manage theirs through the app. */
  private builtInOnly(identity: Identity): HttpResponse | undefined {
    if (this.authKit || identity.id !== 'admin') {
      return sendError(
        400,
        'ERR_ADMIN_MANAGED_BY_APP',
        'This account is managed by your application. Change it there.'
      );
    }
    return undefined;
  }

  private async changePassword(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    const body = await this.body(ctx);
    const current = String(body['currentPassword'] ?? '');
    const next = String(body['newPassword'] ?? '');
    if (!(await this.adminPasswordOk(current)))
      return sendError(400, 'ERR_ADMIN_VALIDATION', 'Current password is incorrect.');
    if (next.length < 12)
      return sendError(
        400,
        'ERR_ADMIN_VALIDATION',
        'New password must be at least 12 characters long.'
      );

    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(next, salt, 32);
    await this.store.set(
      'admin:password',
      `${salt.toString('base64')}:${hash.toString('base64')}`,
      FOREVER
    );
    // Sign out every other session of this account.
    const currentKey = this.sessionKey(ctx);
    for (const [key] of await this.sessionsOf(identity.id))
      if (key !== currentKey) await this.endSession(key, identity.id);

    await this.audit.log('update', {
      resourceId: 'auth_security',
      objectId: identity.id,
      actor: { id: identity.id },
      changes: [{ field: 'password', before: '***', after: '***' }],
      ...this.reqContext(ctx),
    });
    return sendJson({
      ok: true,
      message: 'Password updated.',
    });
  }

  private async setup2fa(identity: Identity): Promise<HttpResponse> {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    const { secret, uri } = this.totp.generateSecret({
      issuer: 'JSango Admin',
      accountName: this.adminEmail,
    });
    await this.store.set('admin:2fa-pending', secret, 600);
    return sendJson({ secret, uri });
  }

  private async verify2fa(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    const secret = await this.store.get('admin:2fa-pending');
    if (!secret)
      return sendError(
        400,
        'ERR_ADMIN_2FA',
        'No pending 2FA setup found. Please restart 2FA setup.'
      );
    const code = String((await this.body(ctx))['code'] ?? '').trim();
    if (!this.totp.verifyToken(code, secret, { window: 1 })) {
      return sendError(
        400,
        'ERR_ADMIN_INVALID_TOTP',
        'Invalid 6-digit code. Check your authenticator app and retry.'
      );
    }
    const backupCodes = this.totp.generateBackupCodes(8);
    await this.store.set('admin:2fa', JSON.stringify({ secret, backupCodes }), FOREVER);
    await this.store.delete('admin:2fa-pending');
    await this.audit.log('update', {
      resourceId: 'auth_security',
      objectId: identity.id,
      actor: { id: identity.id },
      changes: [{ field: 'twoFactor', before: false, after: true }],
      ...this.reqContext(ctx),
    });
    return sendJson({
      ok: true,
      is2faEnabled: true,
      backupCodes,
      message: 'Two-factor authentication enabled.',
    });
  }

  private async disable2fa(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    if (!(await this.adminPasswordOk(String((await this.body(ctx))['password'] ?? '')))) {
      return sendError(400, 'ERR_ADMIN_VALIDATION', 'Password is incorrect.');
    }
    await this.store.delete('admin:2fa');
    await this.store.delete('admin:2fa-pending');
    await this.audit.log('update', {
      resourceId: 'auth_security',
      objectId: identity.id,
      actor: { id: identity.id },
      changes: [{ field: 'twoFactor', before: true, after: false }],
      ...this.reqContext(ctx),
    });
    return sendJson({
      ok: true,
      is2faEnabled: false,
      message: 'Two-factor authentication disabled.',
    });
  }

  private async listSessions(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const currentKey = this.sessionKey(ctx);
    const sessions = (await this.sessionsOf(identity.id))
      .sort(([a], [b]) => (a === currentKey ? -1 : b === currentKey ? 1 : 0))
      .map(([key, s]) => ({
        id: s.id,
        device: s.device,
        ip: s.ip,
        location: s.ip === '127.0.0.1' || s.ip === '::1' ? 'Local' : '',
        lastActive: key === currentKey ? 'Active now' : formatRelativeTime(s.lastActive),
        isCurrent: key === currentKey,
        createdAt: new Date(s.createdAt).toISOString(),
      }));
    return sendJson({ sessions });
  }

  private async deleteSession(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const sessionId = this.param(ctx, 'sessionId');
    const entry = (await this.sessionsOf(identity.id)).find(([, s]) => s.id === sessionId);
    if (!entry) return sendError(404, 'ERR_NOT_FOUND', 'Session not found.');
    await this.endSession(entry[0], identity.id);
    await this.audit.log('delete', {
      resourceId: 'auth_security',
      objectId: sessionId,
      actor: { id: identity.id },
      changes: [{ field: 'session', before: sessionId, after: null }],
      ...this.reqContext(ctx),
    });
    return sendJson({ ok: true, message: 'Session revoked.' });
  }

  private async terminateOthers(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const currentKey = this.sessionKey(ctx);
    for (const [key] of await this.sessionsOf(identity.id))
      if (key !== currentKey) await this.endSession(key, identity.id);
    await this.audit.log('delete', {
      resourceId: 'auth_security',
      objectId: identity.id,
      actor: { id: identity.id },
      changes: [{ field: 'otherSessions', before: true, after: null }],
      ...this.reqContext(ctx),
    });
    return sendJson({ ok: true, message: 'All other sessions have been signed out.' });
  }

  // ------------------------------------------------------------------
  // Dashboard & pages
  // ------------------------------------------------------------------

  /** The fallback dashboard shows audit entries, so it follows the audit log's permission. */
  private dashboard(identity: Identity): AdminDashboard {
    return this.registry.dashboard.getWidgets().length > 0 || !this.canViewAudit(identity)
      ? this.registry.dashboard
      : this.fallbackDashboard;
  }

  /**
   * The audit log holds before/after values of every resource, so limited staff need the
   * `admin.audit.view` permission to read it.
   */
  private canViewAudit(identity: Identity): boolean {
    return (
      this.permissions.hasFullAccess(identity) ||
      identity.hasPermission('admin.audit.view') ||
      identity.hasPermission('admin.*')
    );
  }

  private boardJson(board: AdminDashboard, identity: Identity) {
    return { widgets: board.visibleTo(identity).map((w) => w.toJSON()) };
  }

  private async widgetData(
    ctx: RequestContext,
    board: AdminDashboard,
    identity: Identity
  ): Promise<HttpResponse> {
    const widget = board.getWidget(this.param(ctx, 'widgetId'));
    if (!widget || !widget.isVisibleTo(identity))
      return sendError(404, 'ERR_NOT_FOUND', 'Widget not found.');
    try {
      return sendJson({ data: await widget.load({ identity }) });
    } catch {
      return sendError(500, 'ERR_ADMIN_WIDGET', `Widget "${widget.title}" failed to load.`);
    }
  }

  private visiblePages(identity: Identity) {
    return this.registry
      .getAllPages()
      .filter(
        (pg) => !pg.permission || identity.isSuperuser || identity.hasPermission(pg.permission)
      );
  }

  private page(ctx: RequestContext, identity: Identity) {
    const id = this.param(ctx, 'pageId');
    const page = this.visiblePages(identity).find((pg) => pg.id === id || pg.path === id);
    if (!page) throw new AdminResourceNotFoundError(id);
    return page;
  }

  // ------------------------------------------------------------------
  // Resources & system
  // ------------------------------------------------------------------

  private async listResources(identity: Identity): Promise<HttpResponse> {
    const all = this.registry.getAllResources();
    const allowed = await Promise.all(
      all.map((r) => this.permissions.canViewResource(identity, r))
    );
    const resources = all
      .filter((_, i) => allowed[i])
      .map((r) => ({
        id: r.id,
        label: r.label,
        pluralLabel: r.pluralLabel,
        navigationGroup: r.navigationGroup,
        navigationIcon: r.navigationIcon,
        navigationOrder: r.navigationOrder,
        schema: this.schemaFor(r, identity), // inline, so the UI needs one request, not N+1
      }));
    return sendJson({ resources });
  }

  /** Schema with each relation field's target model resolved to its admin resource id. */
  private schemaFor(r: AdminResource, identity: Identity) {
    const schema = this.crud.getSchema(r, identity);
    return {
      ...schema,
      fields: schema.fields.map((f) =>
        f.relationTarget
          ? { ...f, relatedResource: this.registry.getResource(f.relationTarget)?.id }
          : f
      ),
    };
  }

  private async exportCsv(
    ctx: RequestContext,
    resource: AdminResource,
    identity: Identity
  ): Promise<HttpResponse> {
    const rows = await this.crud.exportCsv(
      resource,
      parseListQuery(ctx.request),
      identity,
      this.reqContext(ctx)
    );
    const encoder = new TextEncoder();
    const bytes = (async function* () {
      for await (const chunk of rows) yield encoder.encode(chunk);
    })();
    const stamp = new Date().toISOString().slice(0, 10);
    return HttpResponse.stream(bytes, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${resource.id}-${stamp}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  private async health(): Promise<HttpResponse> {
    const checks = Object.entries(this.healthChecks);
    const results = await Promise.all(
      checks.map(async ([name, check]) => {
        const started = Date.now();
        try {
          const detail = await Promise.race([
            Promise.resolve().then(check),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timed out after 5s')), 5000).unref?.()
            ),
          ]);
          return [
            name,
            {
              status: 'up',
              label: name,
              subtext: describe(detail) ?? `OK in ${Date.now() - started} ms`,
            },
          ] as const;
        } catch (err) {
          return [
            name,
            {
              status: 'down',
              label: name,
              subtext: err instanceof Error ? err.message : String(err),
            },
          ] as const;
        }
      })
    );
    const services = Object.fromEntries(results);
    const mem = process.memoryUsage();
    return sendJson({
      health: {
        status: results.every(([, r]) => r.status === 'up') ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        resourcesCount: this.registry.getAllResources().length,
        pagesCount: this.registry.getAllPages().length,
        services,
      },
    });
  }

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  private handleError(err: unknown): HttpResponse {
    if (err instanceof AdminAuthorizationError)
      return sendError(403, 'ERR_ADMIN_FORBIDDEN', err.message);
    if (err instanceof AdminItemNotFoundError || err instanceof AdminResourceNotFoundError)
      return sendError(404, 'ERR_NOT_FOUND', err.message);
    if (err instanceof AdminValidationError)
      return sendError(422, 'ERR_ADMIN_VALIDATION', err.message);
    if (err instanceof AdminActionError) return sendError(400, 'ERR_ADMIN_ACTION', err.message);
    // e.g. 413 for an upload over the body size limit
    if (err instanceof HttpError && err.statusCode < 500)
      return sendError(err.statusCode, err.code, err.message);
    return sendError(500, 'ERR_INTERNAL', 'An internal error occurred.');
  }
}

function describe(detail: unknown): string | undefined {
  if (detail === undefined || detail === null || typeof detail === 'boolean') return undefined;
  return typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 200);
}

function parseDeviceFromUserAgent(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

function formatRelativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function identityFromJSON(json: Record<string, unknown>): Identity {
  return new UserIdentity({
    id: String(json['id']),
    roles: (json['roles'] as string[] | undefined) ?? [],
    permissions: (json['permissions'] as string[] | undefined) ?? [],
    tenantId: json['tenantId'] as string | undefined,
    isSuperuser: json['isSuperuser'] === true,
    metadata: (json['metadata'] as Record<string, unknown> | undefined) ?? {},
  });
}

function withProfile(identity: Identity, profile: { email: string; name: string }): Identity {
  return new UserIdentity({
    id: identity.id,
    roles: [...identity.roles],
    permissions: [...identity.permissions],
    tenantId: identity.tenantId,
    isSuperuser: identity.isSuperuser,
    metadata: { ...profile, ...identity.metadata },
  });
}
