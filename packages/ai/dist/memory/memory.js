export class InMemoryMemoryStore {
    store = new Map();
    maxMessages;
    constructor(maxMessages = 50) {
        this.maxMessages = maxMessages;
    }
    async get(key) {
        const list = this.store.get(key) ?? [];
        return [...list];
    }
    async set(key, messages) {
        const trimmed = messages.slice(-this.maxMessages);
        this.store.set(key, trimmed);
    }
    async clear(key) {
        this.store.delete(key);
    }
    async search(query, limit = 5) {
        const results = [];
        const qLower = query.toLowerCase();
        for (const msgs of this.store.values()) {
            for (const m of msgs) {
                if (m.content.toLowerCase().includes(qLower)) {
                    results.push(m.content);
                    if (results.length >= limit)
                        return results;
                }
            }
        }
        return results;
    }
}
export class DatabaseMemoryStore {
    inMemoryFallback = new InMemoryMemoryStore();
    connection;
    constructor(options = {}) {
        this.connection = options.connection;
    }
    async get(key) {
        if (this.connection && typeof this.connection.query === 'function') {
            try {
                const res = await this.connection.query('SELECT messages FROM ai_memory WHERE key = $1', [key]);
                if (res.rows?.[0]?.messages) {
                    return JSON.parse(res.rows[0].messages);
                }
            }
            catch {
                // Fallback
            }
        }
        return this.inMemoryFallback.get(key);
    }
    async set(key, messages) {
        if (this.connection && typeof this.connection.query === 'function') {
            try {
                const payload = JSON.stringify(messages);
                await this.connection.query('INSERT INTO ai_memory (key, messages, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET messages = $2, updated_at = NOW()', [key, payload]);
                return;
            }
            catch {
                // Fallback
            }
        }
        await this.inMemoryFallback.set(key, messages);
    }
    async clear(key) {
        if (this.connection && typeof this.connection.query === 'function') {
            try {
                await this.connection.query('DELETE FROM ai_memory WHERE key = $1', [key]);
                return;
            }
            catch {
                // Fallback
            }
        }
        await this.inMemoryFallback.clear(key);
    }
}
export function memory(type = 'memory') {
    if (type === 'database') {
        return new DatabaseMemoryStore();
    }
    return new InMemoryMemoryStore();
}
//# sourceMappingURL=memory.js.map