import type { CacheStore } from '@jsango/cache';
import type { QueueManager } from '@jsango/queue';
import type { EventBus } from '@jsango/events';
export interface CreateOrderInput {
    customerEmail: string;
    items: Array<{
        productId: string;
        quantity: number;
    }>;
}
export declare class StoreService {
    private readonly cache;
    private readonly queue;
    private readonly eventBus;
    constructor(cache: CacheStore, queue: QueueManager, eventBus: EventBus);
    /**
     * Retrieves active catalog products with transparent cache stampede protection.
     */
    getCatalogProducts(): Promise<Record<string, unknown>[]>;
    /**
     * Creates a new customer order, updates stock, invalidates caches, and triggers events/jobs.
     */
    createOrder(input: CreateOrderInput): Promise<import("@jsango/orm").ModelInstance<{
        id: import("@jsango/orm").FieldDefinition<unknown>;
        orderNumber: import("@jsango/orm").FieldDefinition<unknown>;
        customerEmail: import("@jsango/orm").FieldDefinition<unknown>;
        totalAmount: import("@jsango/orm").FieldDefinition<number>;
        status: import("@jsango/orm").FieldDefinition<string>;
        itemCount: import("@jsango/orm").FieldDefinition<number>;
        createdAt: import("@jsango/orm").FieldDefinition<string>;
    }, Record<string, import("@jsango/orm").RelationOptions>>>;
}
//# sourceMappingURL=store-service.d.ts.map