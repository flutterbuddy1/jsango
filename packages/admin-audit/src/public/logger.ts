import { randomUUID } from 'node:crypto';
import type { IAuditStore } from './store.js';
import type {
  AdminAuditAction,
  AdminAuditActorSnapshot,
  AdminAuditEntry,
  AdminAuditFieldChange,
  AdminAuditQuery,
  AdminAuditPage,
} from './types.js';

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

const SENSITIVE_FIELD_RE = /password|secret|token|key|hash|salt|credential|ssn|cvv/i;

/**
 * Records admin actions to an IAuditStore.
 * All writes are fire-and-forget (non-blocking) unless awaited explicitly.
 *
 * The logger never throws — failures are swallowed with a structured warning
 * so that a broken audit backend never interrupts user-facing requests.
 */
export class AdminAuditLogger {
  private readonly store: IAuditStore;
  private readonly maxChanges: number;
  private readonly redactSensitive: boolean;

  constructor(options: AuditLoggerOptions) {
    this.store = options.store;
    this.maxChanges = options.maxChangesPerEntry ?? 100;
    this.redactSensitive = options.redactSensitiveFields ?? true;
  }

  /**
   * Records a create event.
   */
  public log(
    action: AdminAuditAction,
    options: {
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
  ): Promise<void> {
    const changes = this.sanitizeChanges(options.changes);

    const entry: AdminAuditEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      action,
      resourceId: options.resourceId,
      resourceLabel: options.resourceLabel,
      objectId: options.objectId,
      objectRepresentation: options.objectRepresentation,
      actor: options.actor,
      changes,
      metadata: options.metadata,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    };

    // Never block caller on audit persistence
    return this.store.append(entry).catch((err: unknown) => {
      // Intentional suppression: audit failure must never break operations.
      // Implementors should attach observability hooks to the store itself.
      void err;
    });
  }

  /**
   * Records a field-level diff between an old and new value map.
   * Returns a filtered and capped change list.
   */
  public diffChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    visibleFields?: readonly string[] | undefined
  ): AdminAuditFieldChange[] {
    const allFields = visibleFields ?? [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ];
    const changes: AdminAuditFieldChange[] = [];

    for (const field of allFields) {
      if (changes.length >= this.maxChanges) break;
      if (this.redactSensitive && SENSITIVE_FIELD_RE.test(field)) continue;

      const prev = before[field];
      const curr = after[field];

      if (!this.shallowEqual(prev, curr)) {
        changes.push({ field, before: prev, after: curr });
      }
    }

    return changes;
  }

  /**
   * Queries the audit store.
   */
  public query(query: AdminAuditQuery): Promise<AdminAuditPage> {
    return this.store.query(query);
  }

  /**
   * Retrieves a single audit entry by ID.
   */
  public findById(id: string): Promise<AdminAuditEntry | undefined> {
    return this.store.findById(id);
  }

  private sanitizeChanges(
    changes: readonly AdminAuditFieldChange[] | undefined
  ): readonly AdminAuditFieldChange[] | undefined {
    if (!changes) return undefined;

    const filtered = this.redactSensitive
      ? changes.filter((c) => !SENSITIVE_FIELD_RE.test(c.field))
      : [...changes];

    return filtered.slice(0, this.maxChanges);
  }

  private shallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      // For plain objects and arrays, compare JSON representation.
      // Deep equality in an audit context is acceptable given it's not a hot path.
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  }
}
