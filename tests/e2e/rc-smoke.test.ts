import { describe, it, expect } from 'vitest';
import { Application } from '../../packages/middleware/src/index.js';
import { HttpRequest } from '../../packages/http/src/index.js';
import { Container } from '../../packages/container/src/index.js';
import { createConfigProvider } from '../../packages/config/src/index.js';
import { DatabaseManager } from '../../packages/database/src/index.js';
import { defineModel, fields, setDatabaseManager } from '../../packages/orm/src/index.js';
import {
  ScryptPasswordHasher,
  UserIdentity,
  BasePolicy,
  PolicyRegistry,
} from '../../packages/auth/src/index.js';
import { CacheManager } from '../../packages/cache/src/index.js';
import { QueueManager, JobRegistry } from '../../packages/queue/src/index.js';
import { EventBus, createEvent } from '../../packages/events/src/index.js';
import { RoomManager, LocalTransport } from '../../packages/websocket/src/index.js';
import { AdminRegistry, AdminResource } from '../../packages/admin-core/src/index.js';
import { OpenApiGenerator, OpenApiFormatter } from '../../packages/openapi/src/index.js';
import {
  MetricRegistry,
  StructuredLogger,
  Tracer,
  HealthRegistry,
} from '../../packages/observability/src/index.js';

describe('Phase 17 — 1.0 Production Release End-to-End Smoke Test', () => {
  it('should successfully execute full framework stack lifecycle', async () => {
    // 1. Config & Container
    const config = createConfigProvider({
      APP_NAME: 'jsango-rc-test',
      PORT: 3000,
      NODE_ENV: 'production',
    });
    expect(config.get('APP_NAME')).toBe('jsango-rc-test');

    const container = new Container();
    container.register('config', () => config, 'singleton');
    expect(container.resolve('config')).toBe(config);

    // 2. Database & ORM
    const dbManager = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
        },
      },
    });
    setDatabaseManager(dbManager);

    await dbManager.query(
      `CREATE TABLE users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL
      );`
    );

    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.uuid({ primaryKey: true }),
        email: fields.string({ unique: true }),
        name: fields.string(),
      },
    });

    await User.create({
      id: 'u-1',
      email: 'rc-user@example.com',
      name: 'Release Candidate User',
    });

    const foundUser = await User.query().where('id', '=', 'u-1').first();
    expect(foundUser).toBeDefined();
    expect(foundUser?.get('email')).toBe('rc-user@example.com');

    // 3. Auth & Policies
    const hasher = new ScryptPasswordHasher();
    const passwordHash = await hasher.hash('secure-rc-password');
    const isPasswordValid = await hasher.verify('secure-rc-password', passwordHash);
    expect(isPasswordValid).toBe(true);

    const identity = new UserIdentity({
      id: 'u-1',
      roles: ['admin'],
      metadata: { email: 'rc-user@example.com' },
    });
    class AdminPolicy extends BasePolicy {
      public override readonly name = 'AdminPolicy';
      public async view(id: UserIdentity) {
        return id.hasRole('admin');
      }
    }
    const policyRegistry = new PolicyRegistry();
    policyRegistry.register(new AdminPolicy());
    const pol = policyRegistry.getByName('AdminPolicy');
    expect(pol).toBeDefined();
    const isAllowed = await pol?.can(identity, 'view');
    expect(isAllowed).toBe(true);

    // 4. Cache & Queue
    const cacheManager = new CacheManager();
    const cachedVal = await cacheManager
      .store()
      .remember('rc:key', async () => ({ value: 42 }), { ttlMs: 60000 });
    expect(cachedVal).toEqual({ value: 42 });
    const fetchedVal = await cacheManager.store().get('rc:key');
    expect(fetchedVal).toEqual({ value: 42 });

    const queueManager = new QueueManager();
    const jobRegistry = new JobRegistry();
    let jobProcessed = false;
    jobRegistry.register({
      type: 'send-welcome-email',
      handler: async (ctx) => {
        expect((ctx.payload as { email: string }).email).toBe('rc-user@example.com');
        jobProcessed = true;
      },
    });
    await queueManager.queue().dispatch('send-welcome-email', { email: 'rc-user@example.com' });
    const claimed = await queueManager.queue().driver.claim('default', 'worker-1', 5000, 1);
    expect(claimed.length).toBe(1);
    const dequeuedJob = claimed[0];
    expect(dequeuedJob).toBeDefined();
    if (dequeuedJob) {
      const def = jobRegistry.get(dequeuedJob.type);
      expect(def).toBeDefined();
      await def?.handler({
        job: dequeuedJob,
        payload: dequeuedJob.payload,
        signal: new AbortController().signal,
        attempt: 1,
        logger: queueManager.logger,
      });
      expect(jobProcessed).toBe(true);
    }

    // 5. Events & WebSocket
    const eventBus = new EventBus();
    let eventHandled = false;
    eventBus.on<{ id: string }>('user.created', async (event) => {
      expect(event.payload.id).toBe('u-1');
      eventHandled = true;
    });
    await eventBus.dispatch(createEvent({ type: 'user.created', payload: { id: 'u-1' } }));
    expect(eventHandled).toBe(true);

    const roomManager = new RoomManager();
    const transport = new LocalTransport();
    roomManager.join('conn-1', 'room-global');
    expect(roomManager.hasMember('room-global', 'conn-1')).toBe(true);
    let wsMsgReceived = false;
    transport.subscribe('room-global', (msg) => {
      expect(msg).toEqual({ text: 'rc-broadcast' });
      wsMsgReceived = true;
    });
    transport.publish('room-global', { text: 'rc-broadcast' });
    expect(wsMsgReceived).toBe(true);
    roomManager.leave('conn-1', 'room-global');
    expect(roomManager.hasMember('room-global', 'conn-1')).toBe(false);

    // 6. Admin Core & OpenAPI
    const adminRegistry = new AdminRegistry();
    const userAdminResource = new AdminResource({
      modelName: 'User',
      listFields: ['id', 'email', 'name'],
      searchFields: ['email', 'name'],
    });
    adminRegistry.register(userAdminResource);
    const generatedSchema = userAdminResource.getSchema();
    expect(generatedSchema.id).toBe('user');
    expect(generatedSchema.listFields).toEqual(['id', 'email', 'name']);

    const openApiGen = new OpenApiGenerator({
      info: {
        title: 'jsango Production API',
        version: '1.0.0',
      },
    });
    openApiGen.getRegistry().registerSchema('User', {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
      },
    });
    const doc = openApiGen.generate();
    expect(doc.info.title).toBe('jsango Production API');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.components?.schemas?.['User']).toBeDefined();
    const jsonSpec = OpenApiFormatter.toJson(doc);
    expect(typeof jsonSpec).toBe('string');

    // 7. Observability
    const metrics = new MetricRegistry();
    const counter = metrics.counter('http_requests_total', 'Total HTTP requests');
    counter.inc(1, { method: 'GET', status: '200' });
    expect(counter.get({ method: 'GET', status: '200' })).toBe(1);

    const logger = new StructuredLogger({ minLevel: 'info', redact: false });
    expect(logger).toBeDefined();

    const tracer = new Tracer({ serviceName: 'jsango-rc', sampleRate: 1.0 });
    const span = tracer.startSpan('rc-operation');
    span.setAttribute('test', 'true');
    span.end();
    expect(span.durationMs).toBeGreaterThanOrEqual(0);

    const health = new HealthRegistry();
    health.register('database', async () => ({ status: 'healthy' }));
    const healthResult = await health.checkAll();
    expect(healthResult.status).toBe('healthy');

    // 8. HTTP Application Pipeline & Graceful Request
    const app = new Application({ isProduction: true, container });

    app.use(async (ctx, next) => {
      const res = await next();
      res.headers.set('x-framework', 'jsango-rc');
      return res;
    });

    app.get('/api/users/:id', async (ctx) => {
      const id = ctx.request.params['id'];
      const u = await User.query().where('id', '=', id).first();
      if (!u) {
        return ctx.response.notFound({ error: 'User not found' });
      }
      return {
        id: u.get('id'),
        email: u.get('email'),
        name: u.get('name'),
      };
    });

    const request = new HttpRequest({
      method: 'GET',
      url: new URL('http://localhost:3000/api/users/u-1'),
      headers: new Headers(),
    });

    const response = await app.handle(request);
    expect(response.statusCode).toBe(200);
    expect(response.headers.get('x-framework')).toBe('jsango-rc');

    const bodyText =
      typeof response.body === 'string'
        ? response.body
        : new TextDecoder().decode(response.body as Uint8Array);
    const bodyJson = JSON.parse(bodyText);
    expect(bodyJson).toEqual({
      id: 'u-1',
      email: 'rc-user@example.com',
      name: 'Release Candidate User',
    });

    // 9. Teardown / Cleanup
    await dbManager.close();
    await queueManager.close();
  });
});
