export type {
  DatabaseResult,
  QueryResult,
  FieldMetadata,
  QueryOptions,
  TransactionOptions,
  IsolationLevel,
  DatabaseCapabilities,
  IDriverConnection,
  IDatabaseDriver,
  IDatabaseConnection,
  IDatabaseTransaction,
  ITransaction,
  DatabaseHealthResult,
  MongoCommand,
  IDocumentExecutor,
} from './types.js';

export {
  DatabaseError,
  type DatabaseErrorOptions,
  ConnectionError,
  ConnectionAcquisitionTimeoutError,
  PoolExhaustedError,
  QueryError,
  TransactionError,
  TransactionClosedError,
  IsolationLevelUnsupportedError,
  DatabaseConfigurationError,
} from './errors.js';

export {
  type PoolConfig,
  type ResolvedPoolConfig,
  type ConnectionConfig,
  type DatabaseConfig,
  DEFAULT_POOL_CONFIG,
  maskConnectionString,
  maskConnectionConfig,
  parseConnectionUrl,
  parseSqliteFilename,
  driverFromUrl,
  resolveConnectionConfig,
  databaseConfigFromEnv,
  loadDatabaseConfig,
} from './config.js';

export {
  SqlDialect,
  createDialect,
  normalizeDialectName,
  type DialectName,
  type PlaceholderType,
  type SqlDialectOptions,
} from './dialect.js';

export { DatabaseTransaction, type TransactionState } from './transaction.js';

export { DatabaseConnection, type QueryTelemetryHook } from './connection.js';

export { DatabaseManager, type DatabaseManagerOptions } from './manager.js';

export { MemoryDatabaseDriver, MemoryDriverConnection } from '../internal/drivers/memory-driver.js';
export {
  PostgresDatabaseDriver,
  PostgresDriverConnection,
  type PostgresDriverOptions,
  type PostgresDriverDependencies,
} from '../internal/drivers/postgres-driver.js';
export {
  MysqlDatabaseDriver,
  MysqlDriverConnection,
  type MysqlDriverOptions,
  type MysqlDriverDependencies,
} from '../internal/drivers/mysql-driver.js';
export {
  SqliteDatabaseDriver,
  SqliteDriverConnection,
  type SqliteDriverOptions,
  type SqliteDriverDependencies,
} from '../internal/drivers/sqlite-driver.js';
export {
  MongoDatabaseDriver,
  MongoDriverConnection,
  type MongoDriverOptions,
  type MongoDriverDependencies,
} from '../internal/drivers/mongo-driver.js';
