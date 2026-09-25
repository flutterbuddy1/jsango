import { describe, bench } from 'vitest';
import { Application } from '../../packages/middleware/src/index.js';
import { Router } from '../../packages/router/src/index.js';
import { Container } from '../../packages/container/src/index.js';
import {
  ModelRegistry,
  defineModel,
  stringField,
  integerField,
} from '../../packages/orm/src/index.js';

describe('Startup & Initialization Benchmarks', () => {
  describe('Application Boot', () => {
    bench('create Application and register 20 routes', () => {
      const app = new Application({ isProduction: true });
      for (let i = 0; i < 20; i++) {
        app.get(`/api/v1/resource-${i}`, () => ({ id: i }));
      }
    });

    bench('create Container and register 30 dependencies', () => {
      const c = new Container();
      for (let i = 0; i < 10; i++) {
        c.registerSingleton(`singleton_${i}`, () => ({ i }));
        c.registerTransient(`transient_${i}`, () => ({ i }));
        c.registerScoped(`scoped_${i}`, () => ({ i }));
      }
    });

    bench('create Router and compile radix tree (50 routes)', () => {
      const r = new Router();
      for (let i = 0; i < 50; i++) {
        r.get(`/items/${i}/details/:subId`, () => {});
      }
      r.routes();
    });

    bench('register 10 ORM models in ModelRegistry', () => {
      const reg = new ModelRegistry();
      for (let i = 0; i < 10; i++) {
        const m = defineModel(`Model_${i}`, {
          id: stringField({ primaryKey: true }),
          name: stringField(),
          count: integerField(),
        });
        reg.register(m);
      }
    });
  });
});
