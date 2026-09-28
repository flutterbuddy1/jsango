import { Product, Order } from '../models/index.js';
import { ORDER_CREATED_EVENT } from '../events/order-created-event.js';
import { ORDER_NOTIFICATION_JOB_TYPE } from '../jobs/order-notification-job.js';
export class StoreService {
    cache;
    queue;
    eventBus;
    constructor(cache, queue, eventBus) {
        this.cache = cache;
        this.queue = queue;
        this.eventBus = eventBus;
    }
    /**
     * Retrieves active catalog products with transparent cache stampede protection.
     */
    async getCatalogProducts() {
        return this.cache.remember('catalog:products:active', async () => {
            const products = await Product.query().where('isActive', '=', true).get();
            return products.map((p) => typeof p.toJSON === 'function' ? p.toJSON() : p);
        }, { ttlMs: 60000 });
    }
    /**
     * Creates a new customer order, updates stock, invalidates caches, and triggers events/jobs.
     */
    async createOrder(input) {
        if (!input.items || input.items.length === 0) {
            throw new Error('Order must contain at least one item');
        }
        let totalAmount = 0;
        let totalItems = 0;
        for (const item of input.items) {
            const product = await Product.query().where('id', '=', item.productId).first();
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            const stock = Number(product.stock ?? 0);
            const price = Number(product.price ?? 0);
            if (stock < item.quantity) {
                throw new Error(`Insufficient stock for product ${String(product.name)} (Available: ${stock})`);
            }
            // Deduct inventory
            product.stock = stock - item.quantity;
            await product.save();
            totalAmount += price * item.quantity;
            totalItems += item.quantity;
        }
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        const order = await Order.create({
            orderNumber,
            customerEmail: input.customerEmail,
            totalAmount,
            status: 'pending',
            itemCount: totalItems,
        });
        // Invalidate product catalog cache
        await this.cache.delete('catalog:products:active');
        const payload = {
            orderId: String(order.id),
            orderNumber: String(order.orderNumber),
            customerEmail: String(order.customerEmail),
            totalAmount: Number(order.totalAmount),
            itemCount: Number(order.itemCount),
            createdAt: String(order.createdAt),
        };
        // 1. Dispatch Event across application subsystems
        await this.eventBus.emit({
            type: ORDER_CREATED_EVENT,
            payload,
        });
        // 2. Enqueue asynchronous background job for notifications
        await this.queue.queue('default').dispatch(ORDER_NOTIFICATION_JOB_TYPE, payload);
        return order;
    }
}
//# sourceMappingURL=store-service.js.map