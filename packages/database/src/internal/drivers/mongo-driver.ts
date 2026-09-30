/* eslint-disable @typescript-eslint/no-explicit-any -- wraps the untyped optional 'mongodb' peer client */
import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  MongoCommand,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig, PoolConfig } from '../../public/config.js';
import { ConnectionError, QueryError, TransactionError } from '../../public/errors.js';
import { describeTarget, formatConnectionFailure, importOptional } from './shared.js';

export interface MongoDriverOptions {
  readonly url?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly username?: string | undefined;
  readonly password?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
  readonly pool?: ConnectionConfig['pool'];
  readonly options?: Record<string, unknown> | undefined;
}

export interface MongoDriverDependencies {
  /** Inject the `mongodb` module instead of importing it. */
  readonly mongodb?: unknown;
}

const HEX_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Converts `{ $oid: hex }` markers (and legacy EJSON `{ $date: iso }`) into BSON values before a
 * command is sent to the server.
 */
function revive(value: unknown, ObjectId: any): unknown {
  if (Array.isArray(value)) return value.map((v) => revive(v, ObjectId));
  if (!isPlainObject(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '$oid' && typeof value['$oid'] === 'string') {
    const hex = value['$oid'];
    return HEX_OBJECT_ID.test(hex) ? new ObjectId(hex) : hex;
  }
  if (keys.length === 1 && keys[0] === '$date' && (typeof value['$date'] === 'string' || typeof value['$date'] === 'number')) {
    return new Date(value['$date']);
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = revive(value[key], ObjectId);
  return out;
}

/**
 * Converts BSON values in results into plain JavaScript: ObjectId -> hex string,
 * Decimal128 / Long / Int32 / Double -> number (or bigint for unsafe Longs).
 */
function plain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(plain);
  const bsonType = (value as { _bsontype?: string })._bsontype;
  if (bsonType) {
    switch (bsonType) {
      case 'ObjectId':
      case 'ObjectID':
        return (value as { toHexString(): string }).toHexString();
      case 'Decimal128':
        return Number((value as { toString(): string }).toString());
      case 'Long': {
        const long = value as { toBigInt?(): bigint; toNumber(): number };
        if (typeof long.toBigInt === 'function') {
          const big = long.toBigInt();
          return big <= BigInt(Number.MAX_SAFE_INTEGER) && big >= BigInt(Number.MIN_SAFE_INTEGER)
            ? Number(big)
            : big;
        }
        return long.toNumber();
      }
      case 'Int32':
      case 'Double':
        return (value as { valueOf(): number }).valueOf();
      case 'Binary':
        return (value as { buffer: Uint8Array }).buffer;
      default:
        return value;
    }
  }
  if (value instanceof Uint8Array) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = plain(v);
  return out;
}

function mongoHint(err: unknown, inTransaction = false): string | undefined {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /Transaction numbers are only allowed|replica set member or mongos|does not support transactions/i.test(message) ||
    (inTransaction && /does not support retryable writes/i.test(message))
  ) {
    return 'MongoDB transactions need a replica set or sharded cluster. For local development start mongod with --replSet rs0 and run rs.initiate() once (or use a hosted cluster such as Atlas).';
  }
  if (/E11000/.test(message)) {
    return 'A unique index rejected a duplicate value.';
  }
  if (/Document failed validation/i.test(message)) {
    return 'The document does not match the collection schema created by your migrations (missing required field or wrong type).';
  }
  return undefined;
}

export class MongoDriverConnection implements IDriverConnection {
  private _isClosed = false;
  /** The shared MongoClient (owned by the driver). */
  public readonly client: any = null;
  /** The native `Db` handle, for anything the structured commands do not cover. */
  public readonly db: any = null;
  public readonly config: ConnectionConfig | MongoDriverOptions;
  private readonly ObjectId: any;
  private session: any = null;

  constructor(config: ConnectionConfig | MongoDriverOptions, client?: any, db?: any, ObjectId?: any) {
    this.config = config;
    this.client = client ?? null;
    this.db = db ?? null;
    this.ObjectId = ObjectId ?? class {
      constructor(public readonly hex: string) {}
    };
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public get inTransaction(): boolean {
    return this.session !== null;
  }

  /**
   * Accepts transaction control statements (BEGIN / START TRANSACTION / COMMIT / ROLLBACK), a
   * `SELECT 1` health probe, or a JSON-encoded MongoCommand (legacy form).
   */
  public async query<T = Record<string, unknown>>(
    commandOrJson: string,
    params: readonly unknown[] = [],
    _options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed MongoDB connection.', commandOrJson);
    }

    const text = commandOrJson.trim();
    const upper = text.toUpperCase();

    if (upper === 'BEGIN' || upper.startsWith('BEGIN ') || upper.startsWith('START TRANSACTION')) {
      this.beginSession();
      return { rows: Object.freeze([] as T[]), rowCount: 0 };
    }
    if (upper === 'COMMIT') {
      await this.endSession('commit');
      return { rows: Object.freeze([] as T[]), rowCount: 0 };
    }
    if (upper === 'ROLLBACK') {
      await this.endSession('abort');
      return { rows: Object.freeze([] as T[]), rowCount: 0 };
    }
    if (upper.startsWith('SAVEPOINT') || upper.startsWith('RELEASE') || upper.startsWith('ROLLBACK TO')) {
      throw new TransactionError('MongoDB does not support savepoints (nested transactions).');
    }
    if (upper === 'SELECT 1' || upper.startsWith('SELECT 1 ')) {
      await this.execute({ op: 'command', command: { ping: 1 } });
      return { rows: Object.freeze([{ '1': 1 }] as T[]), rowCount: 1 };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new QueryError(
        'MongoDB connections do not run SQL. Use models (User.where(...).get()), connection.execute({ op: "find", collection: "users", filter: {} }), or db.mongo() for the native driver.',
        text
      );
    }

    const legacy = parsed as { collection?: string; action?: string; op?: string } & Record<string, unknown>;
    if (legacy && typeof legacy.op === 'string') {
      return this.execute<T>(legacy as unknown as MongoCommand);
    }
    if (legacy && typeof legacy.collection === 'string' && typeof legacy.action === 'string') {
      return this.execute<T>(this.fromLegacy(legacy) as MongoCommand);
    }

    void params;
    throw new QueryError(
      'Unsupported MongoDB command. Pass a MongoCommand such as {"op":"find","collection":"users","filter":{}}.',
      text
    );
  }

  private fromLegacy(cmd: { collection?: string; action?: string } & Record<string, unknown>): Record<string, unknown> {
    const collection = cmd.collection!;
    switch (cmd.action) {
      case 'find':
        return { op: 'find', collection, filter: cmd['filter'], sort: cmd['sort'], skip: cmd['skip'], limit: cmd['limit'] };
      case 'insertOne':
        return { op: 'insertOne', collection, document: cmd['doc'] ?? cmd['document'] };
      case 'insertMany':
        return { op: 'insertMany', collection, documents: cmd['docs'] ?? cmd['documents'] };
      case 'updateOne':
      case 'updateMany':
        return { op: cmd.action, collection, filter: cmd['filter'] ?? {}, update: { $set: cmd['update'] } };
      case 'deleteOne':
      case 'deleteMany':
        return { op: cmd.action, collection, filter: cmd['filter'] ?? {} };
      case 'count':
        return { op: 'count', collection, filter: cmd['filter'] };
      case 'aggregate':
        return { op: 'aggregate', collection, pipeline: cmd['pipeline'] ?? [] };
      default:
        throw new QueryError(`Unsupported MongoDB action '${String(cmd.action)}'.`, JSON.stringify(cmd));
    }
  }

  private beginSession(): void {
    if (!this.client) throw new ConnectionError('MongoDB connection has no client.');
    if (this.session) {
      throw new TransactionError('A MongoDB transaction is already active on this connection.');
    }
    this.session = this.client.startSession();
    this.session.startTransaction();
  }

  private async endSession(mode: 'commit' | 'abort'): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.session = null;
    try {
      if (mode === 'commit') await session.commitTransaction();
      else await session.abortTransaction();
    } catch (err) {
      const hint = mongoHint(err);
      throw new TransactionError(
        `MongoDB ${mode === 'commit' ? 'commit' : 'rollback'} failed: ${err instanceof Error ? err.message : String(err)}${hint ? `\nHint: ${hint}` : ''}`,
        err
      );
    } finally {
      await session.endSession();
    }
  }

  public async execute<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute command on closed MongoDB connection.', command.op);
    }
    if (!this.db) {
      throw new ConnectionError('MongoDB connection has no database handle.');
    }

    const opts = this.session ? { session: this.session } : {};
    const r = (v: unknown) => revive(v, this.ObjectId) as any;
    const rows = (docs: unknown[]): DatabaseResult<T> => {
      const out = docs.map((d) => plain(d)) as T[];
      return { rows: Object.freeze(out), rowCount: out.length };
    };

    try {
      switch (command.op) {
        case 'find': {
          const cursor = this.db
            .collection(command.collection)
            .find(r(command.filter ?? {}), { ...opts, projection: command.projection });
          if (command.sort && Object.keys(command.sort).length > 0) cursor.sort(command.sort);
          if (command.skip) cursor.skip(command.skip);
          if (command.limit !== undefined) cursor.limit(command.limit);
          return rows(await cursor.toArray());
        }
        case 'aggregate': {
          const docs = await this.db
            .collection(command.collection)
            .aggregate(r(command.pipeline), opts)
            .toArray();
          return rows(docs);
        }
        case 'count': {
          const n = await this.db.collection(command.collection).countDocuments(r(command.filter ?? {}), opts);
          return { rows: Object.freeze([{ count: n }] as T[]), rowCount: 1 };
        }
        case 'distinct': {
          const values = await this.db
            .collection(command.collection)
            .distinct(command.field, r(command.filter ?? {}), opts);
          return rows(values.map((v: unknown) => ({ [command.field]: v })));
        }
        case 'insertOne': {
          const doc = r(command.document);
          const res = await this.db.collection(command.collection).insertOne(doc, opts);
          const inserted = { ...doc, _id: res.insertedId };
          return { rows: Object.freeze([plain(inserted)] as T[]), rowCount: 1, lastInsertId: plain(res.insertedId) as string };
        }
        case 'insertMany': {
          if (command.documents.length === 0) return { rows: Object.freeze([] as T[]), rowCount: 0 };
          const docs = command.documents.map((d) => r(d));
          const res = await this.db.collection(command.collection).insertMany(docs, { ...opts, ordered: true });
          const inserted = docs.map((d: Record<string, unknown>, i: number) => ({ ...d, _id: res.insertedIds[i] }));
          return { rows: Object.freeze(inserted.map(plain) as T[]), rowCount: res.insertedCount };
        }
        case 'updateOne':
        case 'updateMany': {
          const col = this.db.collection(command.collection);
          const fn = command.op === 'updateOne' ? col.updateOne.bind(col) : col.updateMany.bind(col);
          const res = await fn(r(command.filter), r(command.update), { ...opts, upsert: command.upsert ?? false });
          return {
            rows: Object.freeze([] as T[]),
            rowCount: (res.matchedCount ?? 0) + (res.upsertedCount ?? 0),
            lastInsertId: res.upsertedId ? (plain(res.upsertedId) as string) : undefined,
          };
        }
        case 'deleteOne':
        case 'deleteMany': {
          const col = this.db.collection(command.collection);
          const fn = command.op === 'deleteOne' ? col.deleteOne.bind(col) : col.deleteMany.bind(col);
          const res = await fn(r(command.filter), opts);
          return { rows: Object.freeze([] as T[]), rowCount: res.deletedCount ?? 0 };
        }
        case 'findOneAndUpdate': {
          const res = await this.db.collection(command.collection).findOneAndUpdate(r(command.filter), r(command.update), {
            ...opts,
            upsert: command.upsert ?? false,
            returnDocument: command.returnDocument ?? 'after',
            includeResultMetadata: false,
          });
          return res ? rows([res]) : { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'createCollection': {
          const existing = await this.db.listCollections({ name: command.collection }, { nameOnly: true }).toArray();
          const validation = command.validator
            ? {
                validator: command.validator,
                validationLevel: command.validationLevel ?? 'strict',
                validationAction: command.validationAction ?? 'error',
              }
            : {};
          if (existing.length > 0) {
            if (command.validator) await this.db.command({ collMod: command.collection, ...validation }, opts);
          } else {
            await this.db.createCollection(command.collection, { ...opts, ...validation });
          }
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'collMod': {
          await this.db.command(
            {
              collMod: command.collection,
              validator: command.validator ?? {},
              validationLevel: command.validationLevel ?? (command.validator ? 'strict' : 'off'),
              validationAction: command.validationAction ?? 'error',
            },
            opts
          );
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'dropCollection': {
          const existing = await this.db.listCollections({ name: command.collection }, { nameOnly: true }).toArray();
          if (existing.length > 0) await this.db.collection(command.collection).drop(opts);
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'renameCollection': {
          await this.db.collection(command.collection).rename(command.to, opts);
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'createIndex': {
          await this.db.collection(command.collection).createIndex(command.keys, {
            ...opts,
            name: command.name,
            unique: command.unique ?? false,
            sparse: command.sparse ?? false,
            ...(command.partialFilterExpression ? { partialFilterExpression: command.partialFilterExpression } : {}),
          });
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'dropIndex': {
          await this.db.collection(command.collection).dropIndex(command.name, opts);
          return { rows: Object.freeze([] as T[]), rowCount: 0 };
        }
        case 'listCollections': {
          const list = await this.db.listCollections({}, { nameOnly: false }).toArray();
          return rows(list);
        }
        case 'listIndexes': {
          const list = await this.db.collection(command.collection).listIndexes(opts).toArray();
          return rows(list);
        }
        case 'command': {
          const res = await this.db.command(r(command.command), opts);
          return rows([res]);
        }
        default:
          throw new QueryError(`Unsupported MongoDB operation '${(command as { op: string }).op}'.`, JSON.stringify(command));
      }
    } catch (err: unknown) {
      if (err instanceof QueryError || err instanceof ConnectionError) throw err;
      const hint = mongoHint(err, this.session !== null);
      throw new QueryError(
        `MongoDB ${command.op} failed: ${err instanceof Error ? err.message : String(err)}${hint ? `\nHint: ${hint}` : ''}`,
        'collection' in command ? `${command.op} ${command.collection}` : command.op,
        err,
        { code: (err as { code?: unknown }).code }
      );
    }
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed || !this.db) return false;
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    // Abort a transaction left open by a crashed request; the shared client is closed by the driver.
    if (this.session) {
      await this.endSession('abort').catch(() => undefined);
    }
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
    supportsTransactionalDDL: false,
  };
  public readonly poolDefaults: PoolConfig = { min: 0, max: 10 };

  private client: any = null;
  private connecting: Promise<any> | null = null;
  private mongodb: any = null;
  private readonly config: ConnectionConfig | MongoDriverOptions;
  private readonly deps: MongoDriverDependencies;

  constructor(config: ConnectionConfig | MongoDriverOptions = {}, deps: MongoDriverDependencies = {}) {
    this.config = config;
    this.deps = deps;
  }

  public get target(): string {
    return describeTarget(this.config, 27017);
  }

  private buildUri(): string {
    const cfg = this.config as MongoDriverOptions;
    if (cfg.url) return cfg.url;
    const auth = cfg.username
      ? `${encodeURIComponent(cfg.username)}${cfg.password ? `:${encodeURIComponent(cfg.password)}` : ''}@`
      : '';
    return `mongodb://${auth}${cfg.host ?? '127.0.0.1'}:${cfg.port ?? 27017}`;
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const mongodb: any = this.deps.mongodb ?? (await importOptional('mongodb'));
      if (!mongodb) {
        throw new ConnectionError(
          "MongoDB support requires the 'mongodb' package. Install it in your project: npm install mongodb"
        );
      }
      this.mongodb = mongodb;
      const MongoClient = mongodb.MongoClient ?? mongodb.default?.MongoClient;
      if (typeof MongoClient !== 'function') {
        throw new ConnectionError("The installed 'mongodb' package does not export MongoClient.");
      }
      const cfg = this.config as MongoDriverOptions;
      const poolCfg = cfg.pool ?? {};
      const settings: Record<string, unknown> = {
        maxPoolSize: poolCfg.max ?? 10,
        serverSelectionTimeoutMS: poolCfg.connectionTimeoutMs ?? 10_000,
        ...(cfg.options ?? {}),
      };
      if (cfg.ssl !== undefined) {
        settings['tls'] = cfg.ssl !== false;
        if (cfg.ssl && typeof cfg.ssl === 'object' && cfg.ssl['rejectUnauthorized'] === false) {
          settings['tlsAllowInvalidCertificates'] = true;
        }
      }
      const client = new MongoClient(this.buildUri(), settings);
      try {
        await client.connect();
      } catch (err) {
        await client.close().catch(() => undefined);
        throw new ConnectionError(formatConnectionFailure('MongoDB', this.target, err), err);
      }
      this.client = client;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  /** The native `Db` for this connection's database (for aggregation features not wrapped here). */
  public async getDb(): Promise<any> {
    const client = await this.getClient();
    const cfg = this.config as MongoDriverOptions;
    return cfg.database ? client.db(cfg.database) : client.db();
  }

  public async connect(): Promise<IDriverConnection> {
    const client = await this.getClient();
    const cfg = this.config as MongoDriverOptions;
    const db = cfg.database ? client.db(cfg.database) : client.db();
    const ObjectId = this.mongodb.ObjectId ?? this.mongodb.default?.ObjectId;
    return new MongoDriverConnection(this.config, client, db, ObjectId);
  }

  public async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client && typeof client.close === 'function') {
      await client.close();
    }
  }
}
