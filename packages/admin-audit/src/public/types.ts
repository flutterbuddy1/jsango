/**
 * Structured audit log entry types for the Admin platform.
 * Audit entries are immutable once created.
 */

export type AdminAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'action'
  | 'bulk_action'
  | 'export'
  | 'import'
  | 'login'
  | 'logout';

export interface AdminAuditActorSnapshot {
  readonly id: string | number;
  readonly username?: string | undefined;
  readonly email?: string | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly isSuperuser?: boolean | undefined;
}

export interface AdminAuditFieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface AdminAuditEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly action: AdminAuditAction;
  readonly resourceId: string;
  readonly resourceLabel?: string | undefined;
  readonly objectId?: string | number | undefined;
  readonly objectRepresentation?: string | undefined;
  readonly actor?: AdminAuditActorSnapshot | undefined;
  readonly changes?: readonly AdminAuditFieldChange[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

export interface AdminAuditQuery {
  readonly resourceId?: string | undefined;
  readonly objectId?: string | number | undefined;
  readonly actorId?: string | number | undefined;
  readonly action?: AdminAuditAction | undefined;
  readonly fromDate?: Date | undefined;
  readonly toDate?: Date | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface AdminAuditPage {
  readonly entries: readonly AdminAuditEntry[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
