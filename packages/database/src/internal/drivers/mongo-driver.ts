/* eslint-disable @typescript-eslint/no-explicit-any -- wraps untyped optional peer clients (pg, mysql2, better-sqlite3, node:sqlite, mongodb) */
import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { ConnectionError, QueryError } from '../../public/errors.js';
import { importOptional } from './shared.js';

export interface MongoDriverOptions {
  readonly url?: string | undefined;
  readonly database?: string | undefined;
}

export class MongoDriverConnection implements IDriverConnection {
  private _isClosed = false;
  /** The shared MongoClient (owned by the driver). */
  public readonly client: any = null;
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

    throw new QueryError(
      this.db
        ? 'Unsupported MongoDB command. Pass a JSON command such as {"collection":"users","action":"find","filter":{}} (actions: find, insertOne, insertMany, updateOne, deleteOne).'
        : 'MongoDB connection has no database handle.',
      commandOrJson
    );
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
    // The MongoClient is shared by all connections and owns its own pool; the driver closes it.
    this._isClosed = true;
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

    const mongodb = await importOptional('mongodb');
    if (!mongodb) {
      throw new ConnectionError(
        "MongoDB support requires the 'mongodb' package. Install it in your project: npm install mongodb"
      );
    }
    const MongoClient: any = mongodb.MongoClient ?? mongodb.default?.MongoClient;

    if (!MongoClient) {
      throw new ConnectionError("MongoDB driver could not initialize the MongoClient.");
    }

    try {
      if (!this.client) {
        const client = new MongoClient(uri);
        await client.connect();
        this.client = client;
      }
      const db = this.client.db(dbName);
      return new MongoDriverConnection(this.config, this.client, db);
    } catch (err) {
      await this.client?.close().catch(() => undefined);
      this.client = null;
      throw new ConnectionError(
        `Failed to connect to MongoDB: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
      this.client = null;
    }
  }
}
