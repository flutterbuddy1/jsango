import type { AdminAuditEntry, AdminAuditQuery, AdminAuditPage } from './types.js';
/**
 * Storage backend for audit log entries.
 * Implement this interface to plug in a custom store (database, file, etc).
 */
export interface IAuditStore {
    /**
     * Persists a new audit entry.
     */
    append(entry: AdminAuditEntry): Promise<void>;
    /**
     * Queries audit entries with optional filtering and pagination.
     */
    query(query: AdminAuditQuery): Promise<AdminAuditPage>;
    /**
     * Returns a single audit entry by its ID, or undefined.
     */
    findById(id: string): Promise<AdminAuditEntry | undefined>;
}
/**
 * In-memory audit store for development and testing.
 * Not suitable for production — entries are lost on process restart.
 */
export declare class InMemoryAuditStore implements IAuditStore {
    private readonly entries;
    private seqCounter;
    append(entry: AdminAuditEntry): Promise<void>;
    query(query: AdminAuditQuery): Promise<AdminAuditPage>;
    findById(id: string): Promise<AdminAuditEntry | undefined>;
    clear(): void;
}
//# sourceMappingURL=store.d.ts.map