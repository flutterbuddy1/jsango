/**
 * Shared types for the Admin server layer.
 */
import type { AdminSortDirection } from '@jsango/admin-core';

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
  /** `null` when the resource disables exact counts (`exactCount: false`). */
  readonly total: number | null;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number | null;
  /** Whether a next page exists. */
  readonly hasMore?: boolean | undefined;
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
   * Returns a paginated list of records. The query is already validated: `sort` and `filters`
   * only reference allowed fields, and `pageSize` is within the resource's maximum.
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
    /** Columns to load (list columns plus the primary key); load everything when absent. */
    readonly columns?: readonly string[] | undefined;
    /** When false, skip COUNT(*) and return `total: null` with `hasMore`. Default true. */
    readonly exactCount?: boolean | undefined;
  }): Promise<AdminListResult>;

  /**
   * Streams every matching record in batches (CSV export). Should use keyset pagination so it
   * stays fast on tables with millions of rows.
   */
  stream?(options: {
    readonly modelName: string;
    readonly query: AdminListQuery;
    readonly searchFields: readonly string[];
    readonly primaryKey: string;
    readonly columns?: readonly string[] | undefined;
    readonly batchSize: number;
  }): AsyncIterable<readonly Record<string, unknown>[]>;

  /** Loads several records by primary key in one query. */
  findMany?(options: {
    readonly modelName: string;
    readonly ids: readonly (string | number)[];
    readonly primaryKey: string;
  }): Promise<Record<string, unknown>[]>;

  /** Deletes several records by primary key in one query; returns the number deleted. */
  deleteMany?(options: {
    readonly modelName: string;
    readonly ids: readonly (string | number)[];
    readonly primaryKey: string;
    readonly soft?: boolean | undefined;
  }): Promise<number>;

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
