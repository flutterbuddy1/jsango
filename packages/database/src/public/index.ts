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
  loadDatabaseConfig,
} from './config.js';

export { DatabaseTransaction, type TransactionState } from './transaction.js';

export { DatabaseConnection, type QueryTelemetryHook } from './connection.js';

export { DatabaseManager, type DatabaseManagerOptions } from './manager.js';

export { MemoryDatabaseDriver, MemoryDriverConnection } from '../internal/drivers/memory-driver.js';
