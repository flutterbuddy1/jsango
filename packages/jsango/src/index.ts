// Primary Application & Bootstrap
export { createApp, JSangoApplication, type CrudOptions, type AdminOptions, type AdminCredentials, type AdminResourceEntry, type OpenApiOptions } from './application.js';

// HTTP Layer
export {
  HttpRequest,
  HttpResponse,
  HttpStatus,
  RequestContext,
  HttpHeaders,
  HttpError,
  ContentType,
} from '@jsango/http';
export { Router, RouteGroup, type RouteHandler, type RouteOptions } from '@jsango/router';
export {
  Application,
  type MiddlewareHandler,
  type IMiddleware,
  type MiddlewareDefinition,
  type NextFunction,
} from '@jsango/middleware';

// Validation & Schemas
export {
  schema,
  string,
  number,
  boolean,
  date,
  email,
  array,
  object,
  validate,
  BaseSchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
  ArraySchema,
  ObjectSchema,
  type IValidator,
  type ValidationResult,
  type ValidationErrorItem,
  type ValidationMiddlewareOptions,
} from '@jsango/validation';

// ORM & Models & Database
export {
  model,
  defineModel,
  fields,
  Model,
  QueryBuilder,
  ModelRegistry,
  defaultModelRegistry,
  setDatabaseManager,
  getDatabaseManager,
  transaction,
  getActiveTransaction,
  generateObjectId,
  type WhereGroupCallback,
  type GroupAggregates,
  type GroupByOptions,
  type ModelWriteOptions,
  type TrashedMode,
  type DefinedModelStatic,
  type ModelInstance,
  type FieldDefinition,
  type RelationDefinition,
  type PaginationOptions,
  type PaginationResult,
} from '@jsango/orm';
export {
  DatabaseManager,
  databaseConfigFromEnv,
  parseConnectionUrl,
  SqlDialect,
  DatabaseError,
  ConnectionError,
  QueryError,
  DatabaseConfigurationError,
  type DatabaseConfig,
  type ConnectionConfig,
  type PoolConfig,
  type IDatabaseDriver,
  type IDatabaseConnection,
  type IDatabaseTransaction,
  type QueryResult,
  type DatabaseResult,
  type MongoCommand,
} from '@jsango/database';
export {
  MigrationRunner,
  Migration,
  MigrationContext,
  TableBuilder,
  ColumnModifier,
  defineMigration,
  loadMigrationsFromDirectory,
  MigrationRegistry,
  SchemaState,
  CreateTableOperation,
  DropTableOperation,
  AddColumnOperation,
  DropColumnOperation,
  AlterColumnOperation,
  RenameColumnOperation,
  RenameTableOperation,
  CreateIndexOperation,
  DropIndexOperation,
  CreateUniqueConstraintOperation,
  DropUniqueConstraintOperation,
  AddForeignKeyOperation,
  DropForeignKeyOperation,
  RawSqlOperation,
  MigrationError,
  type MigrationOptions,
  type MigrationPlanStep,
  type ColumnDefinition,
  type TableDefinition,
} from '@jsango/migrations';
export { defineConfig, type JsangoProjectConfig } from '@jsango/cli';

// Auth & Permissions
// Authentication & authorization (everything @jsango/auth exports)
export * from '@jsango/auth';

// Realtime & WebSocket
export {
  type ISimpleWebSocket,
  type WebSocketRouteCallback,
  type WebSocketRouteHandlers,
} from './websocket-wrapper.js';
export {
  WebSocketManager,
  WebSocketConnection,
  RoomManager,
  type IWebSocketConnection,
  type WebSocketIdentity,
  type WebSocketInboundMessage,
  type WebSocketOutboundMessage,
} from '@jsango/websocket';

// Events, Queues & Cache
export {
  events,
  jobs,
  cache,
  response,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  SimpleEventFacade,
  SimpleJobFacade,
  SimpleCacheFacade,
} from './facade.js';
export { EventBus, createEvent } from '@jsango/events';
export { QueueManager } from '@jsango/queue';
export { CacheManager } from '@jsango/cache';

// Admin & OpenAPI & Observability
export * from '@jsango/admin-core';
export { AdminServer, type AdminServerOptions, type IAdminQueryAdapter } from '@jsango/admin-server';
export { type IAuditStore, type AdminAuditEntry } from '@jsango/admin-audit';
export { OpenApiRegistry, OpenApiGenerator } from '@jsango/openapi';
export { StructuredLogger, MetricRegistry, HealthRegistry, Tracer } from '@jsango/observability';

// AI Platform, Agents & Orchestration (everything @jsango/ai exports)
export * from '@jsango/ai';

// CLI
export { CliApplication } from '@jsango/cli';

