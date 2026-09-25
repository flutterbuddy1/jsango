import type { IRouter, RouteHandler } from '@django-js/router';
import type { HttpRequest, RequestContext } from '@django-js/http';
import { HttpResponse, HttpStatus } from '@django-js/http';
import type { Identity } from '@django-js/auth';
import type { AdminRegistry } from '@django-js/admin-core';
import {
  AdminAuthorizationError,
  AdminItemNotFoundError,
  AdminResourceNotFoundError,
  AdminActionError,
  AdminValidationError,
} from '@django-js/admin-core';
import type { AdminPermissionChecker } from '@django-js/admin-auth';
import type { AdminAuditLogger } from '@django-js/admin-audit';
import { AdminCrudService } from './crud-service.js';
import { parseListQuery, sendJson, sendError, extractIpAddress } from './http-helpers.js';
import type { IAdminQueryAdapter } from './types.js';

export interface AdminServerOptions {
  /**
   * Admin registry containing all registered resources and pages.
   */
  readonly registry: AdminRegistry;
  /**
   * ORM query adapter used by the CRUD service layer.
   */
  readonly queryAdapter: IAdminQueryAdapter;
  /**
   * Permission checker used to enforce access control.
   */
  readonly permissions: AdminPermissionChecker;
  /**
   * Audit logger for recording all admin mutations.
   */
  readonly audit: AdminAuditLogger;
  /**
   * URL prefix for all admin routes.
   * Default: '/admin/api/v1'.
   */
  readonly prefix?: string | undefined;
  /**
   * Callback to extract the actor's Identity from a request.
   * Inject from the auth middleware or session.
   */
  readonly resolveIdentity?:
    ((req: HttpRequest) => Promise<Identity | undefined> | Identity | undefined) | undefined;
}

/**
 * Registers all Admin HTTP API routes onto the provided router instance.
 *
 * Route structure (relative to prefix):
 *
 *   GET    /resources                          — list registered resources
 *   GET    /resources/:resourceId/schema       — resource schema
 *   GET    /resources/:resourceId              — list items
 *   POST   /resources/:resourceId              — create item
 *   GET    /resources/:resourceId/:id          — retrieve item
 *   PATCH  /resources/:resourceId/:id          — update item
 *   DELETE /resources/:resourceId/:id          — delete item
 *   POST   /resources/:resourceId/:id/restore  — restore soft-deleted item
 *   POST   /resources/:resourceId/:id/actions/:actionId   — row action
 *   POST   /resources/:resourceId/bulk/:actionId          — bulk action
 *   GET    /audit                              — query audit log
 */
export class AdminServer {
  private readonly registry: AdminRegistry;
  private readonly crud: AdminCrudService;
  private readonly permissions: AdminPermissionChecker;
  private readonly audit: AdminAuditLogger;
  private readonly prefix: string;
  private readonly resolveIdentity: (req: HttpRequest) => Promise<Identity | undefined>;

  constructor(options: AdminServerOptions) {
    this.registry = options.registry;
    this.permissions = options.permissions;
    this.audit = options.audit;
    this.prefix = options.prefix ?? '/admin/api/v1';

    this.crud = new AdminCrudService({
      queryAdapter: options.queryAdapter,
      permissions: options.permissions,
      audit: options.audit,
    });

    const resolver = options.resolveIdentity;
    this.resolveIdentity = resolver ? async (req) => resolver(req) : async () => undefined;
  }

  /**
   * Mounts all Admin routes onto the given router.
   * Call this during application bootstrap after the registry is populated.
   */
  public mount(router: IRouter): void {
    const p = this.prefix;

    // Resource list
    router.get(`${p}/resources`, this.handleListResources());

    // Resource schema
    router.get(`${p}/resources/:resourceId/schema`, this.handleGetSchema());

    // CRUD
    router.get(`${p}/resources/:resourceId`, this.handleList());
    router.post(`${p}/resources/:resourceId`, this.handleCreate());
    router.get(`${p}/resources/:resourceId/:id`, this.handleDetail());
    router.patch(`${p}/resources/:resourceId/:id`, this.handleUpdate());
    router.delete(`${p}/resources/:resourceId/:id`, this.handleDelete());

    // Soft-delete restore
    router.post(`${p}/resources/:resourceId/:id/restore`, this.handleRestore());

    // Row actions
    router.post(`${p}/resources/:resourceId/:id/actions/:actionId`, this.handleAction());

    // Bulk actions
    router.post(`${p}/resources/:resourceId/bulk/:actionId`, this.handleBulkAction());

    // Audit log
    router.get(`${p}/audit`, this.handleAuditQuery());
  }

  // ------------------------------------------------------------------
  // Route Handlers
  // ------------------------------------------------------------------

  private handleListResources(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      const identity = await this.resolveIdentity(req);
      if (!this.permissions.canAccessAdmin(identity)) {
        return sendError(403, 'ERR_ADMIN_FORBIDDEN', 'Admin access denied.');
      }

      const resources = this.registry.getAllResources().map((r) => ({
        id: r.id,
        label: r.label,
        pluralLabel: r.pluralLabel,
        navigationGroup: r.navigationGroup,
        navigationIcon: r.navigationIcon,
        navigationOrder: r.navigationOrder,
      }));

      return sendJson({ resources });
    };
  }

  private handleGetSchema(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId } = req.params as { resourceId: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const schema = this.crud.getSchema(resource, identity);
        return sendJson({ schema });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleList(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId } = req.params as { resourceId: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const query = parseListQuery(req);
        const result = await this.crud.list(resource, query, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson(result);
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleCreate(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId } = req.params as { resourceId: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const body = await req.body.json<Record<string, unknown>>();
        const item = await this.crud.create(resource, body, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson({ item }, HttpStatus.CREATED);
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleDetail(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, id } = req.params as { resourceId: string; id: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const item = await this.crud.detail(resource, id, identity);
        return sendJson({ item });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleUpdate(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, id } = req.params as { resourceId: string; id: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const body = await req.body.json<Record<string, unknown>>();
        const item = await this.crud.update(resource, id, body, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson({ item });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleDelete(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, id } = req.params as { resourceId: string; id: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        await this.crud.delete(resource, id, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson(null, HttpStatus.NO_CONTENT);
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleRestore(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, id } = req.params as { resourceId: string; id: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const item = await this.crud.restore(resource, id, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson({ item });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleAction(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, id, actionId } = req.params as {
          resourceId: string;
          id: string;
          actionId: string;
        };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const body = await req.body.json<unknown>().catch(() => undefined);
        const result = await this.crud.executeAction(resource, actionId, id, body, identity, {
          ipAddress: extractIpAddress(req),
          userAgent: req.headers.get('user-agent') ?? undefined,
        });

        return sendJson({ result });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleBulkAction(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const { resourceId, actionId } = req.params as { resourceId: string; actionId: string };
        const identity = await this.resolveIdentity(req);
        const resource = this.registry.getResource(resourceId);

        if (!resource) {
          return sendError(
            404,
            'ERR_ADMIN_RESOURCE_NOT_FOUND',
            `Resource "${resourceId}" not found.`
          );
        }

        const body = await req.body
          .json<{ ids: (string | number)[]; input?: unknown }>()
          .catch(() => ({ ids: [] as (string | number)[], input: undefined }));

        if (!Array.isArray(body.ids)) {
          return sendError(400, 'ERR_ADMIN_VALIDATION', '"ids" must be an array.');
        }

        const result = await this.crud.executeBulkAction(
          resource,
          actionId,
          body.ids,
          body.input,
          identity,
          {
            ipAddress: extractIpAddress(req),
            userAgent: req.headers.get('user-agent') ?? undefined,
          }
        );

        return sendJson({ result });
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  private handleAuditQuery(): RouteHandler {
    return async (ctx: RequestContext) => {
      const req = ctx.request;
      try {
        const identity = await this.resolveIdentity(req);
        if (!this.permissions.canAccessAdmin(identity)) {
          return sendError(403, 'ERR_ADMIN_FORBIDDEN', 'Admin access denied.');
        }

        const qs = req.query;
        const page = await this.audit.query({
          resourceId: qs.get('resourceId') ?? undefined,
          action: (qs.get('action') as never) ?? undefined,
          actorId: qs.get('actorId') ?? undefined,
          fromDate: qs.get('fromDate') ? new Date(qs.get('fromDate')!) : undefined,
          toDate: qs.get('toDate') ? new Date(qs.get('toDate')!) : undefined,
          limit: parseInt(qs.get('limit') ?? '50', 10),
          offset: parseInt(qs.get('offset') ?? '0', 10),
        });

        return sendJson(page);
      } catch (err: unknown) {
        return this.handleError(err);
      }
    };
  }

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  private handleError(err: unknown): HttpResponse {
    if (err instanceof AdminAuthorizationError) {
      return sendError(403, 'ERR_ADMIN_FORBIDDEN', err.message);
    }
    if (err instanceof AdminItemNotFoundError || err instanceof AdminResourceNotFoundError) {
      return sendError(404, 'ERR_NOT_FOUND', err.message);
    }
    if (err instanceof AdminValidationError) {
      return sendError(422, 'ERR_ADMIN_VALIDATION', err.message);
    }
    if (err instanceof AdminActionError) {
      return sendError(400, 'ERR_ADMIN_ACTION', err.message);
    }

    // Unknown error — log internally but return a safe 500
    void err;
    return sendError(500, 'ERR_INTERNAL', 'An internal error occurred.');
  }
}
