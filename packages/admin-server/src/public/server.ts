import * as crypto from 'node:crypto';
import type { IRouter, RouteHandler } from '@jsango/router';
import type { HttpRequest, RequestContext } from '@jsango/http';
import { HttpResponse, HttpStatus } from '@jsango/http';
import {
  type Identity,
  type Auth,
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
import { AdminCrudService } from './crud-service.js';
import { parseListQuery, sendJson, sendError, extractIpAddress } from './http-helpers.js';
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
  /** Resolves the identity for requests that don't carry an admin session token. */
  readonly resolveIdentity?:
    ((req: HttpRequest) => Promise<Identity | undefined> | Identity | undefined) | undefined;
}

interface AdminSession {
  readonly id: string;
  readonly identity: Identity;
  readonly createdAt: number;
  lastActive: number;
  readonly device: string;
  readonly ip: string;
}

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
  private readonly totp = new TotpService();
  private readonly adminEmail: string;
  private readonly adminUsername: string;
  private adminPassword: string;
  private readonly passwordConfigured: boolean;
  private readonly adminName: string;
  /** Keyed by sha256(token): a leaked memory dump doesn't reveal usable tokens. */
  private readonly sessions = new Map<string, AdminSession>();
  private readonly loginFailures = new Map<string, { count: number; resetAt: number }>();
  private readonly twoFactor = new Map<string, { secret: string; backupCodes: string[] }>();
  private readonly pending2fa = new Map<string, string>();
  private readonly fallbackDashboard: AdminDashboard;
  private readonly exportTickets = new Map<
    string,
    { identity: Identity; resourceId: string; expiresAt: number }
  >();

  constructor(options: AdminServerOptions) {
    this.registry = options.registry;
    this.permissions = options.permissions;
    this.audit = options.audit;
    this.prefix = options.prefix ?? '/admin/api/v1';
    this.authKit = options.authKit;
    this.resolver = options.resolveIdentity;
    this.sessionTtlMs = (options.sessionTtlSeconds ?? 8 * 3600) * 1000;
    this.healthChecks = options.healthChecks ?? {};

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

  public mount(router: IRouter): void {
    const p = this.prefix;

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
      this.admin((_ctx, identity) => sendJson(this.boardJson(this.dashboard(), identity)))
    );
    router.get(
      `${p}/dashboard/widgets/:widgetId`,
      this.admin((ctx, identity) => this.widgetData(ctx, this.dashboard(), identity))
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
      this.resource((_ctx, r, identity) => sendJson({ schema: this.crud.getSchema(r, identity) }))
    );
    // Export: POST returns a one-time download URL (valid 60s), so the browser can stream the
    // file natively without putting the session token in a URL.
    router.post(
      `${p}/resources/:resourceId/export`,
      this.resource(async (ctx, r, identity) => {
        const ticket = crypto.randomBytes(24).toString('base64url');
        this.exportTickets.set(ticket, {
          identity,
          resourceId: r.id,
          expiresAt: Date.now() + 60_000,
        });
        const params = new URLSearchParams(String((await this.body(ctx))['query'] ?? ''));
        params.set('ticket', ticket);
        return sendJson({ url: `/resources/${encodeURIComponent(r.id)}/export?${params}` });
      })
    );
    router.get(
      `${p}/resources/:resourceId/export`,
      this.route(async (ctx) => {
        const ticketId = ctx.request.query.get('ticket') ?? '';
        const ticket = this.exportTickets.get(ticketId);
        this.exportTickets.delete(ticketId);
        for (const [id, t] of this.exportTickets)
          if (t.expiresAt < Date.now()) this.exportTickets.delete(id);
        const resource = this.registry.getResource(this.param(ctx, 'resourceId'));
        if (
          !ticket ||
          ticket.expiresAt < Date.now() ||
          !resource ||
          resource.id !== ticket.resourceId
        ) {
          return sendError(
            401,
            'ERR_ADMIN_UNAUTHORIZED',
            'Download link expired. Start the export again.'
          );
        }
        return this.exportCsv(ctx, resource, ticket.identity);
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
      this.admin(async (ctx) => {
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
    return extractIpAddress(ctx.request) ?? ctx.request.ip ?? 'unknown';
  }

  // ------------------------------------------------------------------
  // Identity & sessions
  // ------------------------------------------------------------------

  private bearer(ctx: RequestContext): string | undefined {
    return /^Bearer\s+(\S+)$/i.exec(ctx.request.headers.get('authorization') ?? '')?.[1];
  }

  private currentSession(ctx: RequestContext): { key: string; session: AdminSession } | undefined {
    const token = this.bearer(ctx);
    if (!token) return undefined;
    const key = sha256(token);
    const session = this.sessions.get(key);
    if (!session) return undefined;
    if (Date.now() - session.createdAt > this.sessionTtlMs) {
      this.sessions.delete(key);
      return undefined;
    }
    return { key, session };
  }

  private async resolveIdentity(ctx: RequestContext): Promise<Identity | undefined> {
    const current = this.currentSession(ctx);
    if (current) {
      current.session.lastActive = Date.now();
      return current.session.identity;
    }
    if (this.authKit) {
      const result = await this.authKit.authenticate(ctx);
      if (result.status === 'authenticated') return result.identity;
    }
    return this.resolver ? this.resolver(ctx.request) : undefined;
  }

  private startSession(ctx: RequestContext, identity: Identity): string {
    const token = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(sha256(token), {
      id: crypto.randomUUID(),
      identity,
      createdAt: Date.now(),
      lastActive: Date.now(),
      device: parseDeviceFromUserAgent(ctx.request.headers.get('user-agent') ?? ''),
      ip: this.ip(ctx),
    });
    return token;
  }

  private sessionsOf(identityId: string): Array<[string, AdminSession]> {
    return [...this.sessions].filter(
      ([, s]) => s.identity.id === identityId && Date.now() - s.createdAt <= this.sessionTtlMs
    );
  }

  // ------------------------------------------------------------------
  // Login
  // ------------------------------------------------------------------

  private lockedOut(keys: string[]): boolean {
    return keys.some((k) => {
      const entry = this.loginFailures.get(k);
      if (entry && entry.resetAt < Date.now()) this.loginFailures.delete(k);
      return (
        (this.loginFailures.get(k)?.count ?? 0) >=
        (k.startsWith('ip:') ? MAX_LOGIN_FAILURES * 4 : MAX_LOGIN_FAILURES)
      );
    });
  }

  private recordFailure(keys: string[]): void {
    for (const k of keys) {
      const entry = this.loginFailures.get(k) ?? { count: 0, resetAt: Date.now() + LOCKOUT_MS };
      entry.count++;
      this.loginFailures.set(k, entry);
    }
  }

  private async login(ctx: RequestContext): Promise<HttpResponse> {
    const body = await this.body(ctx);
    const login = String(body['email'] ?? body['username'] ?? '').trim();
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
      if (!this.passwordConfigured && process.env['NODE_ENV'] === 'production') {
        return sendError(
          503,
          'ERR_ADMIN_NOT_CONFIGURED',
          'Admin login is disabled: set JSANGO_ADMIN_PASSWORD or use admin({ auth: createAuth(...) }).'
        );
      }
      const keys = [`user:${login.toLowerCase()}`, `ip:${this.ip(ctx)}`];
      if (this.lockedOut(keys))
        return sendError(
          429,
          'ERR_TOO_MANY_ATTEMPTS',
          'Too many failed attempts. Try again later.'
        );

      const userOk = [this.adminEmail, this.adminUsername].some(
        (u) => u.toLowerCase() === login.toLowerCase()
      );
      const passwordOk = safeEqual(password, this.adminPassword);
      if (!userOk || !passwordOk) {
        this.recordFailure(keys);
        return sendError(401, 'ERR_INVALID_CREDENTIALS', 'Invalid email/username or password.');
      }

      const tfa = this.twoFactor.get('admin');
      if (tfa) {
        if (!totpCode)
          return sendJson({
            ok: false,
            requires2fa: true,
            message: 'Enter the 6-digit code from your authenticator app.',
          });
        const backup = this.totp.verifyAndConsumeBackupCode(totpCode, tfa.backupCodes);
        if (!this.totp.verifyToken(totpCode, tfa.secret, { window: 1 }) && !backup.valid) {
          this.recordFailure(keys);
          return sendError(400, 'ERR_INVALID_2FA', 'Invalid two-factor code.');
        }
        if (backup.valid) tfa.backupCodes = backup.remainingCodes;
      }
      for (const k of keys) this.loginFailures.delete(k);

      identity = new UserIdentity({
        id: 'admin',
        isSuperuser: true,
        roles: ['admin', 'superuser'],
        permissions: ['admin.access', 'admin.*'],
        metadata: { username: this.adminUsername, email: this.adminEmail, name: this.adminName },
      });
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

    const token = this.startSession(ctx, identity);
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
    const current = this.currentSession(ctx);
    if (current) {
      this.sessions.delete(current.key);
      await this.audit.log('logout', {
        resourceId: 'auth',
        objectId: current.session.identity.id,
        actor: { id: current.session.identity.id },
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

  private profile(identity: Identity): HttpResponse {
    const meta = (identity.metadata ?? {}) as Record<string, unknown>;
    const tfa = this.authKit ? undefined : this.twoFactor.get(identity.id);
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
    if (!safeEqual(current, this.adminPassword))
      return sendError(400, 'ERR_ADMIN_VALIDATION', 'Current password is incorrect.');
    if (next.length < 12)
      return sendError(
        400,
        'ERR_ADMIN_VALIDATION',
        'New password must be at least 12 characters long.'
      );

    this.adminPassword = next;
    // Sign out every other session of this account.
    const currentKey = this.currentSession(ctx)?.key;
    for (const [key] of this.sessionsOf(identity.id))
      if (key !== currentKey) this.sessions.delete(key);

    await this.audit.log('update', {
      resourceId: 'auth_security',
      objectId: identity.id,
      actor: { id: identity.id },
      changes: [{ field: 'password', before: '***', after: '***' }],
      ...this.reqContext(ctx),
    });
    return sendJson({
      ok: true,
      message:
        'Password updated. It lasts until the server restarts: set JSANGO_ADMIN_PASSWORD to make it permanent.',
    });
  }

  private setup2fa(identity: Identity): HttpResponse {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    const { secret, uri } = this.totp.generateSecret({
      issuer: 'JSango Admin',
      accountName: this.adminEmail,
    });
    this.pending2fa.set(identity.id, secret);
    return sendJson({ secret, uri });
  }

  private async verify2fa(ctx: RequestContext, identity: Identity): Promise<HttpResponse> {
    const blocked = this.builtInOnly(identity);
    if (blocked) return blocked;
    const secret = this.pending2fa.get(identity.id);
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
    this.twoFactor.set(identity.id, { secret, backupCodes: [...backupCodes] });
    this.pending2fa.delete(identity.id);
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
    if (!safeEqual(String((await this.body(ctx))['password'] ?? ''), this.adminPassword)) {
      return sendError(400, 'ERR_ADMIN_VALIDATION', 'Password is incorrect.');
    }
    this.twoFactor.delete(identity.id);
    this.pending2fa.delete(identity.id);
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

  private listSessions(ctx: RequestContext, identity: Identity): HttpResponse {
    const currentKey = this.currentSession(ctx)?.key;
    const sessions = this.sessionsOf(identity.id)
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
    const entry = this.sessionsOf(identity.id).find(([, s]) => s.id === sessionId);
    if (!entry) return sendError(404, 'ERR_NOT_FOUND', 'Session not found.');
    this.sessions.delete(entry[0]);
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
    const currentKey = this.currentSession(ctx)?.key;
    for (const [key] of this.sessionsOf(identity.id))
      if (key !== currentKey) this.sessions.delete(key);
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

  private dashboard(): AdminDashboard {
    return this.registry.dashboard.getWidgets().length > 0
      ? this.registry.dashboard
      : this.fallbackDashboard;
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
        schema: this.crud.getSchema(r, identity), // inline, so the UI needs one request, not N+1
      }));
    return sendJson({ resources });
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
        activeSessions: this.sessions.size,
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
