import type { IRouter } from '@jsango/router';
import { HttpResponse, HttpStatus } from '@jsango/http';
import type { StoreService } from '../services/store-service.js';
import { Order } from '../models/index.js';

export function registerApiRoutes(router: IRouter, storeService: StoreService): void {
  // Public Catalog API
  router.get('/api/products', async () => {
    const products = await storeService.getCatalogProducts();
    return HttpResponse.json({
      success: true,
      data: products,
      timestamp: new Date().toISOString(),
    });
  });

  // Public Order Placement API
  router.post('/api/orders', async (ctx) => {
    try {
      const body = (await ctx.request.body.json()) as {
        customerEmail: string;
        items: Array<{ productId: string; quantity: number }>;
      };

      if (!body.customerEmail || !body.items || body.items.length === 0) {
        return HttpResponse.json(
          { success: false, error: 'customerEmail and items array are required' },
          { status: HttpStatus.BAD_REQUEST }
        );
      }

      const order = await storeService.createOrder(body);
      return HttpResponse.json(
        {
          success: true,
          message: 'Order placed successfully and queued for fulfillment',
          order: typeof order.toJSON === 'function' ? order.toJSON() : order,
        },
        { status: HttpStatus.CREATED }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place order';
      return HttpResponse.json(
        { success: false, error: message },
        { status: HttpStatus.BAD_REQUEST }
      );
    }
  });

  // Order Details API
  router.get('/api/orders/:id', async (ctx) => {
    const id = ctx.request.params['id'];
    const order = await Order.query().where('id', '=', id).first();
    if (!order) {
      return HttpResponse.json(
        { success: false, error: 'Order not found' },
        { status: HttpStatus.NOT_FOUND }
      );
    }
    return HttpResponse.json({
      success: true,
      order: typeof order.toJSON === 'function' ? order.toJSON() : order,
    });
  });

  // Health and Subsystem Diagnostics API
  router.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      framework: 'JSango',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  });
}
