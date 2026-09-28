import type { IAuditStore } from './store.js';
import type { AdminAuditAction, AdminAuditActorSnapshot, AdminAuditEntry, AdminAuditFieldChange, AdminAuditQuery, AdminAuditPage } from './types.js';
export interface AuditLoggerOptions {
    readonly store: IAuditStore;
    /**
     * Maximum number of field changes to record per entry.
     * Prevents runaway memory usage on wide records.
     * Default: 100.
     */
    readonly maxChangesPerEntry?: number | undefined;
    /**
     * If true, sensitive field changes (fields whose names match the sensitivity
     * pattern) are omitted from the `changes` list but the action is still
     * recorded. Default: true.
     */
    readonly redactSensitiveFields?: boolean | undefined;
}
/**
 * Records admin actions to an IAuditStore.
 * All writes are fire-and-forget (non-blocking) unless awaited explicitly.
 *
 * The logger never throws — failures are swallowed with a structured warning
 * so that a broken audit backend never interrupts user-facing requests.
 */
export declare class AdminAuditLogger {
    private readonly store;
    private readonly maxChanges;
    private readonly redactSensitive;
    constructor(options: AuditLoggerOptions);
    /**
     * Records a create event.
     */
    log(action: AdminAuditAction, options: {
        readonly resourceId: string;
        readonly resourceLabel?: string | undefined;
        readonly objectId?: string | number | undefined;
        readonly objectRepresentation?: string | undefined;
        readonly actor?: AdminAuditActorSnapshot | undefined;
        readonly changes?: readonly AdminAuditFieldChange[] | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
        readonly ipAddress?: string | undefined;
        readonly userAgent?: string | undefined;
    }): Promise<void>;
    /**
     * Records a field-level diff between an old and new value map.
     * Returns a filtered and capped change list.
     */
    diffChanges(before: Record<string, unknown>, after: Record<string, unknown>, visibleFields?: readonly string[] | undefined): AdminAuditFieldChange[];
    /**
     * Queries the audit store.
     */
    query(query: AdminAuditQuery): Promise<AdminAuditPage>;
    /**
     * Retrieves a single audit entry by ID.
     */
    findById(id: string): Promise<AdminAuditEntry | undefined>;
    private sanitizeChanges;
    private shallowEqual;
}
//# sourceMappingURL=logger.d.ts.map