/**
 * Shared types for the Admin server layer.
 */
import type { AdminSortDirection } from '@django-js/admin-core';

export interface AdminListQuery {
  readonly page?: number | undefined;
  readonly pageSize?: number | undefined;
  readonly search?: string | undefined;
  readonly sort?: string | undefined;
  readonly sortDirection?: AdminSortDirection | undefined;
  readonly filters?: Record<string, unknown> | undefined;
}

export interface AdminListResult<T = Record<string, unknown>> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface AdminRequestContext {
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

export interface AdminCrudOptions {
  /**
   * ORM query adapter — the admin-server calls this to execute
   * queries without directly importing ORM classes.
   */
  readonly queryAdapter: IAdminQueryAdapter;
}

/**
 * Adapter that bridges admin-server to the ORM.
 * This lets the admin-server avoid a direct ORM import while still
 * executing real database operations.
 */
export interface IAdminQueryAdapter {
  /**
   * Returns a paginated list of records for the given resource.
   */
  list(options: {
    readonly modelName: string;
    readonly query: AdminListQuery;
    readonly searchFields: readonly string[];
    readonly primaryKey: string;
    readonly defaultSortField: string;
    readonly defaultSortDirection: AdminSortDirection;
    readonly pageSize: number;
    readonly maxPageSize: number;
  }): Promise<AdminListResult>;

  /**
   * Returns a single record by primary key, or null.
   */
  findById(options: {
    readonly modelName: string;
    readonly id: string | number;
    readonly primaryKey: string;
  }): Promise<Record<string, unknown> | null>;

  /**
   * Creates a new record and returns it.
   */
  create(options: {
    readonly modelName: string;
    readonly data: Record<string, unknown>;
    readonly primaryKey: string;
  }): Promise<Record<string, unknown>>;

  /**
   * Updates an existing record and returns the updated version.
   */
  update(options: {
    readonly modelName: string;
    readonly id: string | number;
    readonly data: Record<string, unknown>;
    readonly primaryKey: string;
  }): Promise<Record<string, unknown>>;

  /**
   * Deletes a record by primary key.
   */
  delete(options: {
    readonly modelName: string;
    readonly id: string | number;
    readonly primaryKey: string;
    readonly soft?: boolean | undefined;
  }): Promise<void>;

  /**
   * Restores a soft-deleted record.
   */
  restore?(options: {
    readonly modelName: string;
    readonly id: string | number;
    readonly primaryKey: string;
  }): Promise<Record<string, unknown>>;
}
