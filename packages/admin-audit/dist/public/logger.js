import { randomUUID } from 'node:crypto';
const SENSITIVE_FIELD_RE = /password|secret|token|key|hash|salt|credential|ssn|cvv/i;
/**
 * Records admin actions to an IAuditStore.
 * All writes are fire-and-forget (non-blocking) unless awaited explicitly.
 *
 * The logger never throws — failures are swallowed with a structured warning
 * so that a broken audit backend never interrupts user-facing requests.
 */
export class AdminAuditLogger {
    store;
    maxChanges;
    redactSensitive;
    constructor(options) {
        this.store = options.store;
        this.maxChanges = options.maxChangesPerEntry ?? 100;
        this.redactSensitive = options.redactSensitiveFields ?? true;
    }
    /**
     * Records a create event.
     */
    log(action, options) {
        const changes = this.sanitizeChanges(options.changes);
        const entry = {
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
        return this.store.append(entry).catch((err) => {
            // Intentional suppression: audit failure must never break operations.
            // Implementors should attach observability hooks to the store itself.
            void err;
        });
    }
    /**
     * Records a field-level diff between an old and new value map.
     * Returns a filtered and capped change list.
     */
    diffChanges(before, after, visibleFields) {
        const allFields = visibleFields ?? [
            ...new Set([...Object.keys(before), ...Object.keys(after)]),
        ];
        const changes = [];
        for (const field of allFields) {
            if (changes.length >= this.maxChanges)
                break;
            if (this.redactSensitive && SENSITIVE_FIELD_RE.test(field))
                continue;
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
    query(query) {
        return this.store.query(query);
    }
    /**
     * Retrieves a single audit entry by ID.
     */
    findById(id) {
        return this.store.findById(id);
    }
    sanitizeChanges(changes) {
        if (!changes)
            return undefined;
        const filtered = this.redactSensitive
            ? changes.filter((c) => !SENSITIVE_FIELD_RE.test(c.field))
            : [...changes];
        return filtered.slice(0, this.maxChanges);
    }
    shallowEqual(a, b) {
        if (a === b)
            return true;
        if (a === null || b === null)
            return false;
        if (typeof a !== typeof b)
            return false;
        if (typeof a === 'object') {
            // For plain objects and arrays, compare JSON representation.
            // Deep equality in an audit context is acceptable given it's not a hot path.
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            }
            catch {
                return false;
            }
        }
        return false;
    }
}
//# sourceMappingURL=logger.js.map