import { describe, it, expect, beforeEach } from 'vitest';
import { HttpRequest } from '@jsango/http';
import { createEnterpriseApp, type EnterpriseAppInstance } from './app.js';
import { Product, Order, User } from './models/index.js';

describe('JSango Enterprise Showcase Application', () => {
  let instance: EnterpriseAppInstance;

  beforeEach(async () => {
    instance = await createEnterpriseApp();
  });

  describe('1. Models and Database Seeding', () => {
    it('seeds users, products, and initial orders in the in-memory database', async () => {
      const userCount = await User.query().count();
      const productCount = await Product.query().count();
      const orderCount = await Order.query().count();

      expect(userCount).toBeGreaterThanOrEqual(3);
      expect(productCount).toBeGreaterThanOrEqual(4);
      expect(orderCount).toBeGreaterThanOrEqual(1);

      const adminUser = await User.query().where('email', '=', 'admin@jsango.dev').first();
      expect(adminUser).toBeDefined();
      expect(adminUser?.role).toBe('admin');
      expect(adminUser?.isStaff).toBe(true);
    });
  });

  describe('2. Public Store REST API', () => {
    it('GET /api/products returns active products', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/products',
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('POST /api/orders places a new order, deducts stock, and queues background fulfillment', async () => {
      const headphones = await Product.query().where('sku', '=', 'SKU-AUDIO-001').first();
      expect(headphones).toBeDefined();
      const initialStock = Number(headphones!.stock);

      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/orders',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerEmail: 'customer@enterprise.com',
          items: [{ productId: headphones!.id, quantity: 2 }],
        }),
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(201);

      const body = JSON.parse(String(res.body));
      expect(body.success).toBe(true);
      expect(body.order.customerEmail).toBe('customer@enterprise.com');
      expect(body.order.itemCount).toBe(2);

      // Verify stock was deducted
      const updatedHeadphones = await Product.query().where('id', '=', headphones!.id).first();
      expect(Number(updatedHeadphones?.stock)).toBe(initialStock - 2);

      // Verify queue received the notification job
      const stats = await instance.queue.queue('default').stats();
      expect(
        stats.pendingCount + stats.completedCount + stats.processingCount
      ).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/health returns runtime diagnostics', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/health',
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.status).toBe('healthy');
      expect(body.framework).toBe('JSango');
    });
  });

  describe('3. Admin Server API & Platform', () => {
    let adminAuthToken = '';

    beforeEach(async () => {
      const loginReq = new HttpRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/admin/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@jsango.dev',
          password: 'admin123',
        }),
      });
      const loginRes = await instance.app.handle(loginReq);
      const loginBody = JSON.parse(String(loginRes.body));
      adminAuthToken = loginBody.data.token;
    });

    it('POST /api/admin/auth/login authenticates administrator with credentials', async () => {
      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/admin/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@jsango.dev',
          password: 'admin123',
        }),
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.ok).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.user.email).toBe('admin@jsango.dev');
      expect(body.data.user.isSuperuser).toBe(true);
    });

    it('GET /api/admin/resources lists all registered resources', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/admin/resources',
        headers: { authorization: `Bearer ${adminAuthToken}` },
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.ok).toBe(true);
      const resourceIds = body.data.resources.map((r: { id: string }) => r.id);
      expect(resourceIds).toContain('users');
      expect(resourceIds).toContain('products');
      expect(resourceIds).toContain('orders');
    });

    it('GET /api/admin/resources/products/schema returns full schema with bulk actions', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/admin/resources/products/schema',
        headers: { authorization: `Bearer ${adminAuthToken}` },
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.ok).toBe(true);
      expect(body.data.schema.id).toBe('products');
      expect(body.data.schema.primaryKey).toBe('id');
      expect(body.data.schema.bulkActions.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/admin/resources/products creates a new catalog product via Admin API', async () => {
      const req = new HttpRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/admin/resources/products',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminAuthToken}`,
        },
        body: JSON.stringify({
          sku: 'SKU-NEW-404',
          name: 'Ultra Wide 4K Curved Monitor',
          category: 'Electronics',
          price: 699.99,
          stock: 15,
          isActive: true,
        }),
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(201);

      const body = JSON.parse(String(res.body));
      expect(body.ok).toBe(true);
      expect(body.data.item.name).toBe('Ultra Wide 4K Curved Monitor');
      expect(body.data.item.sku).toBe('SKU-NEW-404');

      // Verify product exists in ORM
      const created = await Product.query().where('sku', '=', 'SKU-NEW-404').first();
      expect(created).toBeDefined();
    });

    it('GET /api/admin/system/health returns platform health check', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/admin/system/health',
        headers: { authorization: `Bearer ${adminAuthToken}` },
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(String(res.body));
      expect(body.ok).toBe(true);
      expect(body.data.health.status).toBe('healthy');
    });
  });

  describe('4. Admin UI HTML Delivery', () => {
    it('GET /admin renders the rich JSango Admin Console HTML shell', async () => {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/admin',
      });

      const res = await instance.app.handle(req);
      expect(res.statusCode).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(String(res.body)).toContain('JSango');
      expect(String(res.body)).toContain('administration');
    });
  });
});
