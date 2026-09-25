import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type { IConfigProvider } from '@jsango/config';
import { createConfigProvider } from '@jsango/config';
import type { Application } from '@jsango/middleware';
import type { DatabaseManager } from '@jsango/database';
import type { MigrationRegistry } from '@jsango/migrations';
import { defaultMigrationRegistry } from '@jsango/migrations';
import type { ModelRegistry } from '@jsango/orm';
import { getDefaultRegistry } from '@jsango/orm';
import type { CacheManager } from '@jsango/cache';
import type { QueueManager } from '@jsango/queue';
import type { EventBus } from '@jsango/events';
import type { IWebSocketServer } from '@jsango/websocket';
import { CliOutput } from './output.js';
import { ProjectDiscovery } from '../internal/project.js';

export interface CommandContextOptions {
  readonly args?: readonly (string | number | boolean)[] | undefined;
  readonly options?: Readonly<Record<string, unknown>> | undefined;
  readonly rawArgs?: readonly string[] | undefined;
  readonly cwd?: string | undefined;
  readonly projectRoot?: string | undefined;
  readonly env?: string | undefined;
  readonly output?: CliOutput | undefined;
  readonly logger?: ILogger | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly config?: IConfigProvider | undefined;
  readonly application?: Application | undefined;
  readonly databaseManager?: DatabaseManager | undefined;
  readonly migrationRegistry?: MigrationRegistry | undefined;
  readonly modelRegistry?: ModelRegistry | undefined;
  readonly cacheManager?: CacheManager | undefined;
  readonly queueManager?: QueueManager | undefined;
  readonly eventBus?: EventBus | undefined;
  readonly wsServer?: IWebSocketServer | undefined;
}

export class CommandContext {
  public readonly args: readonly (string | number | boolean)[];
  public readonly options: Readonly<Record<string, unknown>>;
  public readonly rawArgs: readonly string[];
  public readonly cwd: string;
  public readonly projectRoot: string;
  public readonly env: string;
  public readonly output: CliOutput;
  public readonly logger: ILogger;
  public readonly signal?: AbortSignal | undefined;

  private _config?: IConfigProvider | undefined;
  private _application?: Application | undefined;
  private _databaseManager?: DatabaseManager | undefined;
  private _migrationRegistry?: MigrationRegistry | undefined;
  private _modelRegistry?: ModelRegistry | undefined;
  private _cacheManager?: CacheManager | undefined;
  private _queueManager?: QueueManager | undefined;
  private _eventBus?: EventBus | undefined;
  private _wsServer?: IWebSocketServer | undefined;

  private readonly cleanupHooks: (() => Promise<void> | void)[] = [];

  public constructor(options: CommandContextOptions = {}) {
    this.args = Object.freeze([...(options.args ?? [])]);
    this.options = Object.freeze({ ...(options.options ?? {}) });
    this.rawArgs = Object.freeze([...(options.rawArgs ?? [])]);
    this.cwd = options.cwd ?? process.cwd();

    // Auto-discover project root if not explicitly provided
    const discovered = options.projectRoot
      ? { rootDir: options.projectRoot }
      : ProjectDiscovery.findProjectRoot(this.cwd);

    this.projectRoot = discovered?.rootDir ?? this.cwd;
    this.env =
      options.env ??
      (this.options['env'] as string | undefined) ??
      process.env['JSANGO_ENV'] ??
      process.env['NODE_ENV'] ??
      'development';

    this.output = options.output ?? new CliOutput();
    this.logger = options.logger ?? new NoopLogger();
    this.signal = options.signal;

    this._config = options.config;
    this._application = options.application;
    this._databaseManager = options.databaseManager;
    this._migrationRegistry = options.migrationRegistry;
    this._modelRegistry = options.modelRegistry;
    this._cacheManager = options.cacheManager;
    this._queueManager = options.queueManager;
    this._eventBus = options.eventBus;
    this._wsServer = options.wsServer;
  }

  public registerCleanup(cleanup: () => Promise<void> | void): void {
    this.cleanupHooks.push(cleanup);
  }

  public async cleanup(): Promise<void> {
    while (this.cleanupHooks.length > 0) {
      const hook = this.cleanupHooks.pop()!;
      try {
        await hook();
      } catch (err) {
        this.logger.error('Error during command cleanup', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  public getConfig(): IConfigProvider {
    if (!this._config) {
      this._config = createConfigProvider({
        env: this.env,
        projectRoot: this.projectRoot,
      });
    }
    return this._config;
  }

  public setConfig(config: IConfigProvider): void {
    this._config = config;
  }

  public setApplication(app: Application): void {
    this._application = app;
  }

  public async getApplication(): Promise<Application | undefined> {
    return this._application;
  }

  public setDatabaseManager(db: DatabaseManager): void {
    this._databaseManager = db;
    this.registerCleanup(async () => {
      await db.close();
    });
  }

  public async getDatabaseManager(): Promise<DatabaseManager | undefined> {
    if (this._databaseManager) {
      return this._databaseManager;
    }
    if (this._application?.container.has('db')) {
      return this._application.container.resolve<DatabaseManager>('db');
    }
    return undefined;
  }

  public getMigrationRegistry(): MigrationRegistry {
    if (!this._migrationRegistry) {
      this._migrationRegistry = defaultMigrationRegistry;
    }
    return this._migrationRegistry;
  }

  public setMigrationRegistry(registry: MigrationRegistry): void {
    this._migrationRegistry = registry;
  }

  public getModelRegistry(): ModelRegistry {
    if (!this._modelRegistry) {
      this._modelRegistry = getDefaultRegistry();
    }
    return this._modelRegistry;
  }

  public setModelRegistry(registry: ModelRegistry): void {
    this._modelRegistry = registry;
  }

  public setCacheManager(cache: CacheManager): void {
    this._cacheManager = cache;
    this.registerCleanup(async () => {
      await cache.close();
    });
  }

  public async getCacheManager(): Promise<CacheManager | undefined> {
    if (this._cacheManager) {
      return this._cacheManager;
    }
    if (this._application?.container.has('cache')) {
      return this._application.container.resolve<CacheManager>('cache');
    }
    return undefined;
  }

  public setQueueManager(queue: QueueManager): void {
    this._queueManager = queue;
    this.registerCleanup(async () => {
      await queue.close();
    });
  }

  public async getQueueManager(): Promise<QueueManager | undefined> {
    if (this._queueManager) {
      return this._queueManager;
    }
    if (this._application?.container.has('queue')) {
      return this._application.container.resolve<QueueManager>('queue');
    }
    return undefined;
  }

  public setEventBus(bus: EventBus): void {
    this._eventBus = bus;
    this.registerCleanup(() => {
      bus.close();
    });
  }

  public async getEventBus(): Promise<EventBus | undefined> {
    if (this._eventBus) {
      return this._eventBus;
    }
    if (this._application?.container.has('events')) {
      return this._application.container.resolve<EventBus>('events');
    }
    return undefined;
  }

  public setWebSocketServer(server: IWebSocketServer): void {
    this._wsServer = server;
    this.registerCleanup(async () => {
      await server.close();
    });
  }

  public async getWebSocketServer(): Promise<IWebSocketServer | undefined> {
    if (this._wsServer) {
      return this._wsServer;
    }
    if (this._application?.container.has('websocket')) {
      return this._application.container.resolve<IWebSocketServer>('websocket');
    }
    return undefined;
  }
}
