import { NoopLogger } from '@jsango/core';
import { createConfigProvider } from '@jsango/config';
import { defaultMigrationRegistry } from '@jsango/migrations';
import { getDefaultRegistry } from '@jsango/orm';
import { CliOutput } from './output.js';
import { ProjectDiscovery } from '../internal/project.js';
export class CommandContext {
    args;
    options;
    rawArgs;
    cwd;
    projectRoot;
    env;
    output;
    logger;
    signal;
    _config;
    _application;
    _databaseManager;
    _migrationRegistry;
    _modelRegistry;
    _cacheManager;
    _queueManager;
    _eventBus;
    _wsServer;
    cleanupHooks = [];
    constructor(options = {}) {
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
                this.options['env'] ??
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
    registerCleanup(cleanup) {
        this.cleanupHooks.push(cleanup);
    }
    async cleanup() {
        while (this.cleanupHooks.length > 0) {
            const hook = this.cleanupHooks.pop();
            try {
                await hook();
            }
            catch (err) {
                this.logger.error('Error during command cleanup', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }
    getConfig() {
        if (!this._config) {
            this._config = createConfigProvider({
                env: this.env,
                projectRoot: this.projectRoot,
            });
        }
        return this._config;
    }
    setConfig(config) {
        this._config = config;
    }
    setApplication(app) {
        this._application = app;
    }
    async getApplication() {
        return this._application;
    }
    setDatabaseManager(db) {
        this._databaseManager = db;
        this.registerCleanup(async () => {
            await db.close();
        });
    }
    async getDatabaseManager() {
        if (this._databaseManager) {
            return this._databaseManager;
        }
        if (this._application?.container.has('db')) {
            return this._application.container.resolve('db');
        }
        return undefined;
    }
    getMigrationRegistry() {
        if (!this._migrationRegistry) {
            this._migrationRegistry = defaultMigrationRegistry;
        }
        return this._migrationRegistry;
    }
    setMigrationRegistry(registry) {
        this._migrationRegistry = registry;
    }
    getModelRegistry() {
        if (!this._modelRegistry) {
            this._modelRegistry = getDefaultRegistry();
        }
        return this._modelRegistry;
    }
    setModelRegistry(registry) {
        this._modelRegistry = registry;
    }
    setCacheManager(cache) {
        this._cacheManager = cache;
        this.registerCleanup(async () => {
            await cache.close();
        });
    }
    async getCacheManager() {
        if (this._cacheManager) {
            return this._cacheManager;
        }
        if (this._application?.container.has('cache')) {
            return this._application.container.resolve('cache');
        }
        return undefined;
    }
    setQueueManager(queue) {
        this._queueManager = queue;
        this.registerCleanup(async () => {
            await queue.close();
        });
    }
    async getQueueManager() {
        if (this._queueManager) {
            return this._queueManager;
        }
        if (this._application?.container.has('queue')) {
            return this._application.container.resolve('queue');
        }
        return undefined;
    }
    setEventBus(bus) {
        this._eventBus = bus;
        this.registerCleanup(() => {
            bus.close();
        });
    }
    async getEventBus() {
        if (this._eventBus) {
            return this._eventBus;
        }
        if (this._application?.container.has('events')) {
            return this._application.container.resolve('events');
        }
        return undefined;
    }
    setWebSocketServer(server) {
        this._wsServer = server;
        this.registerCleanup(async () => {
            await server.close();
        });
    }
    async getWebSocketServer() {
        if (this._wsServer) {
            return this._wsServer;
        }
        if (this._application?.container.has('websocket')) {
            return this._application.container.resolve('websocket');
        }
        return undefined;
    }
}
//# sourceMappingURL=context.js.map