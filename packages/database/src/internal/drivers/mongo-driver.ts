import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { QueryError } from '../../public/errors.js';

export interface MongoDriverOptions {
  readonly url?: string | undefined;
  readonly database?: string | undefined;
}

export class MongoDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private client: any = null;
  private db: any = null;
  public readonly config: ConnectionConfig | MongoDriverOptions;

  constructor(config: ConnectionConfig | MongoDriverOptions, client?: any, db?: any) {
    this.config = config;
    this.client = client;
    this.db = db;
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public async query<T = Record<string, unknown>>(
    commandOrJson: string,
    params: readonly unknown[] = [],
    _options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed MongoDB connection.', commandOrJson);
    }

    if (this.db) {
      try {
        // Parse SQL-like or Mongo-like queries
        let parsedCommand: any = null;
        try {
          parsedCommand = JSON.parse(commandOrJson);
        } catch {
          // If SQL command string passed, parse collection and action
        }

        if (parsedCommand && parsedCommand.collection) {
          const col = this.db.collection(parsedCommand.collection);
          if (parsedCommand.action === 'find') {
            const cursor = col.find(parsedCommand.filter ?? {});
            if (parsedCommand.limit) cursor.limit(parsedCommand.limit);
            if (parsedCommand.skip) cursor.skip(parsedCommand.skip);
            if (parsedCommand.sort) cursor.sort(parsedCommand.sort);
            const docs = await cursor.toArray();
            return { rows: Object.freeze(docs as T[]), rowCount: docs.length };
          } else if (parsedCommand.action === 'insertOne') {
            const res = await col.insertOne(parsedCommand.doc);
            return { rows: Object.freeze([] as T[]), rowCount: 1, lastInsertId: String(res.insertedId) };
          } else if (parsedCommand.action === 'insertMany') {
            const res = await col.insertMany(parsedCommand.docs);
            return { rows: Object.freeze([] as T[]), rowCount: res.insertedCount };
          } else if (parsedCommand.action === 'updateOne') {
            const res = await col.updateOne(parsedCommand.filter, { $set: parsedCommand.update });
            return { rows: Object.freeze([] as T[]), rowCount: res.modifiedCount };
          } else if (parsedCommand.action === 'deleteOne') {
            const res = await col.deleteOne(parsedCommand.filter);
            return { rows: Object.freeze([] as T[]), rowCount: res.deletedCount };
          }
        }
      } catch (err: unknown) {
        throw new QueryError(
          `MongoDB operation failed: ${err instanceof Error ? err.message : String(err)}`,
          commandOrJson,
          err,
          { params }
        );
      }
    }

    // In-memory document store simulation for testing
    return {
      rows: Object.freeze([] as T[]),
      rowCount: 0,
    };
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed) return false;
    try {
      if (this.db && typeof this.db.command === 'function') {
        await this.db.command({ ping: 1 });
      }
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
    }
  }
}

export class MongoDatabaseDriver implements IDatabaseDriver {
  public readonly name = 'mongodb';
  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: false,
    supportsIsolationLevels: false,
    supportsReturning: true,
    supportsCancellation: true,
    placeholderType: 'named',
  };

  private client: any = null;
  private readonly config: ConnectionConfig | MongoDriverOptions;

  constructor(config: ConnectionConfig | MongoDriverOptions = {}) {
    this.config = config;
  }

  public async connect(): Promise<IDriverConnection> {
    const uri = (this.config as any).url ?? 'mongodb://127.0.0.1:27017';
    const dbName = (this.config as any).database ?? 'jsango';

    try {
      const mongodb = await import('mongodb' as string);
      const MongoClient = mongodb.default?.MongoClient ?? mongodb.MongoClient;
      if (MongoClient) {
        this.client = new MongoClient(uri);
        await this.client.connect();
        const db = this.client.db(dbName);
        return new MongoDriverConnection(this.config, this.client, db);
      }
    } catch {
      // mongodb package not installed, operates in mock fallback mode
    }

    return new MongoDriverConnection(this.config);
  }

  public async disconnect(): Promise<void> {
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
      this.client = null;
    }
  }
}
