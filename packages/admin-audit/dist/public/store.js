/**
 * In-memory audit store for development and testing.
 * Not suitable for production — entries are lost on process restart.
 */
export class InMemoryAuditStore {
    entries = [];
    seqCounter = 0;
    async append(entry) {
        this.entries.push({ entry, seq: ++this.seqCounter });
    }
    async query(query) {
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
    async findById(id) {
        const found = this.entries.find((item) => item.entry.id === id);
        return found ? found.entry : undefined;
    }
    clear() {
        this.entries.length = 0;
    }
}
//# sourceMappingURL=store.js.map