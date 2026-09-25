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
export class InMemoryAuditStore implements IAuditStore {
  private readonly entries: { entry: AdminAuditEntry; seq: number }[] = [];
  private seqCounter = 0;

  public async append(entry: AdminAuditEntry): Promise<void> {
    this.entries.push({ entry, seq: ++this.seqCounter });
  }

  public async query(query: AdminAuditQuery): Promise<AdminAuditPage> {
    let results = [...this.entries];

    if (query.resourceId !== undefined) {
      results = results.filter((item) => item.entry.resourceId === query.resourceId);
    }
    if (query.objectId !== undefined) {
      const id = String(query.objectId);
      results = results.filter((item) => String(item.entry.objectId) === id);
    }
    if (query.actorId !== undefined) {
      const id = String(query.actorId);
      results = results.filter((item) => String(item.entry.actor?.id) === id);
    }
    if (query.action !== undefined) {
      results = results.filter((item) => item.entry.action === query.action);
    }
    if (query.fromDate !== undefined) {
      const from = query.fromDate.getTime();
      results = results.filter((item) => item.entry.timestamp.getTime() >= from);
    }
    if (query.toDate !== undefined) {
      const to = query.toDate.getTime();
      results = results.filter((item) => item.entry.timestamp.getTime() <= to);
    }

    // Sort newest-first: primary by timestamp, secondary by seq descending
    results.sort((a, b) => {
      const timeDiff = b.entry.timestamp.getTime() - a.entry.timestamp.getTime();
      return timeDiff !== 0 ? timeDiff : b.seq - a.seq;
    });

    const total = results.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const page = results.slice(offset, offset + limit).map((i) => i.entry);

    return { entries: page, total, limit, offset };
  }

  public async findById(id: string): Promise<AdminAuditEntry | undefined> {
    const found = this.entries.find((item) => item.entry.id === id);
    return found ? found.entry : undefined;
  }

  public clear(): void {
    this.entries.length = 0;
  }
}
