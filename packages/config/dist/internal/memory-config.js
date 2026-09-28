export class MemoryConfigProvider {
    store = new Map();
    constructor(initialValues) {
        if (initialValues) {
            for (const [key, value] of Object.entries(initialValues)) {
                this.store.set(key, value);
            }
        }
    }
    static fromRuntime(runtime) {
        const env = runtime.getAllEnv();
        const store = {};
        for (const [key, val] of Object.entries(env)) {
            if (typeof val !== 'undefined') {
                store[key] = val;
            }
        }
        return new MemoryConfigProvider(store);
    }
    get(key, defaultValue) {
        const value = this.store.get(key);
        if (typeof value === 'undefined') {
            if (typeof defaultValue !== 'undefined') {
                return defaultValue;
            }
            return undefined;
        }
        return value;
    }
    getString(key, defaultValue) {
        const val = this.get(key);
        if (typeof val === 'string')
            return val;
        if (typeof val !== 'undefined' && val !== null)
            return String(val);
        if (typeof defaultValue === 'string')
            return defaultValue;
        return '';
    }
    getNumber(key, defaultValue) {
        const val = this.get(key);
        if (typeof val === 'number')
            return val;
        if (typeof val === 'string') {
            const parsed = Number(val);
            if (!Number.isNaN(parsed))
                return parsed;
        }
        return defaultValue ?? 0;
    }
    getBoolean(key, defaultValue) {
        const val = this.get(key);
        if (typeof val === 'boolean')
            return val;
        if (typeof val === 'string') {
            const lower = val.toLowerCase();
            if (lower === 'true' || lower === '1')
                return true;
            if (lower === 'false' || lower === '0')
                return false;
        }
        return defaultValue ?? false;
    }
    has(key) {
        return this.store.has(key);
    }
}
//# sourceMappingURL=memory-config.js.map