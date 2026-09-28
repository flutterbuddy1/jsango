/**
 * In-memory storage backend for development and testing.
 * Files are stored in a Map; all URLs are synthetic data-URI-like placeholders.
 */
export class InMemoryMediaStorage {
    store_ = new Map();
    counter = 0;
    async store(options) {
        const key = `${options.prefix ?? 'uploads'}/${++this.counter}-${options.originalName}`;
        const file = {
            key,
            originalName: options.originalName,
            mimeType: options.mimeType,
            size: options.content.byteLength,
            url: `memory://${key}`,
            metadata: options.metadata,
        };
        this.store_.set(key, {
            file,
            content: options.content instanceof Buffer ? options.content : Buffer.from(options.content),
        });
        return file;
    }
    async get(key) {
        return this.store_.get(key)?.file;
    }
    async delete(options) {
        this.store_.delete(options.key);
    }
    async url(key) {
        return this.store_.get(key)?.file.url ?? `memory://${key}`;
    }
    clear() {
        this.store_.clear();
        this.counter = 0;
    }
}
//# sourceMappingURL=storage.js.map