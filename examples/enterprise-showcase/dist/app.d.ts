import { Application } from '@jsango/middleware';
import { DatabaseManager } from '@jsango/database';
import { CacheStore } from '@jsango/cache';
import { QueueManager } from '@jsango/queue';
import { EventBus } from '@jsango/events';
import { StoreService } from './services/store-service.js';
export interface EnterpriseAppInstance {
    app: Application;
    dbManager: DatabaseManager;
    cache: CacheStore;
    queue: QueueManager;
    eventBus: EventBus;
    storeService: StoreService;
}
export declare function createEnterpriseApp(): Promise<EnterpriseAppInstance>;
//# sourceMappingURL=app.d.ts.map