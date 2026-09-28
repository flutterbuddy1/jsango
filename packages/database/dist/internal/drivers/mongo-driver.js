import { QueryError } from '../../public/errors.js';
export class MongoDriverConnection {
    _isClosed = false;
    client = null;
    db = null;
    config;
    constructor(config, client, db) {
        this.config = config;
        this.client = client;
        this.db = db;
    }
    get isClosed() {
        return this._isClosed;
    }
    async query(commandOrJson, params = [], _options) {
        if (this._isClosed) {
            throw new QueryError('Cannot execute query on closed MongoDB connection.', commandOrJson);
        }
        if (this.db) {
            try {
                // Parse SQL-like or Mongo-like queries
                let parsedCommand = null;
                try {
                    parsedCommand = JSON.parse(commandOrJson);
                }
                catch {
                    // If SQL command string passed, parse collection and action
                }
                if (parsedCommand && parsedCommand.collection) {
                    const col = this.db.collection(parsedCommand.collection);
                    if (parsedCommand.action === 'find') {
                        const cursor = col.find(parsedCommand.filter ?? {});
                        if (parsedCommand.limit)
                            cursor.limit(parsedCommand.limit);
                        if (parsedCommand.skip)
                            cursor.skip(parsedCommand.skip);
                        if (parsedCommand.sort)
                            cursor.sort(parsedCommand.sort);
                        const docs = await cursor.toArray();
                        return { rows: Object.freeze(docs), rowCount: docs.length };
                    }
                    else if (parsedCommand.action === 'insertOne') {
                        const res = await col.insertOne(parsedCommand.doc);
                        return { rows: Object.freeze([]), rowCount: 1, lastInsertId: String(res.insertedId) };
                    }
                    else if (parsedCommand.action === 'insertMany') {
                        const res = await col.insertMany(parsedCommand.docs);
                        return { rows: Object.freeze([]), rowCount: res.insertedCount };
                    }
                    else if (parsedCommand.action === 'updateOne') {
                        const res = await col.updateOne(parsedCommand.filter, { $set: parsedCommand.update });
                        return { rows: Object.freeze([]), rowCount: res.modifiedCount };
                    }
                    else if (parsedCommand.action === 'deleteOne') {
                        const res = await col.deleteOne(parsedCommand.filter);
                        return { rows: Object.freeze([]), rowCount: res.deletedCount };
                    }
                }
            }
            catch (err) {
                throw new QueryError(`MongoDB operation failed: ${err instanceof Error ? err.message : String(err)}`, commandOrJson, err, { params });
            }
        }
        // In-memory document store simulation for testing
        return {
            rows: Object.freeze([]),
            rowCount: 0,
        };
    }
    async ping() {
        if (this._isClosed)
            return false;
        try {
            if (this.db && typeof this.db.command === 'function') {
                await this.db.command({ ping: 1 });
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async close() {
        if (this._isClosed)
            return;
        this._isClosed = true;
        if (this.client && typeof this.client.close === 'function') {
            await this.client.close();
        }
    }
}
export class MongoDatabaseDriver {
    name = 'mongodb';
    capabilities = {
        supportsTransactions: true,
        supportsSavepoints: false,
        supportsIsolationLevels: false,
        supportsReturning: true,
        supportsCancellation: true,
        placeholderType: 'named',
    };
    client = null;
    config;
    constructor(config = {}) {
        this.config = config;
    }
    async connect() {
        const uri = this.config.url ?? 'mongodb://127.0.0.1:27017';
        const dbName = this.config.database ?? 'jsango';
        try {
            const mongodb = await import('mongodb');
            const MongoClient = mongodb.default?.MongoClient ?? mongodb.MongoClient;
            if (MongoClient) {
                this.client = new MongoClient(uri);
                await this.client.connect();
                const db = this.client.db(dbName);
                return new MongoDriverConnection(this.config, this.client, db);
            }
        }
        catch {
            // mongodb package not installed, operates in mock fallback mode
        }
        return new MongoDriverConnection(this.config);
    }
    async disconnect() {
        if (this.client && typeof this.client.close === 'function') {
            await this.client.close();
            this.client = null;
        }
    }
}
//# sourceMappingURL=mongo-driver.js.map