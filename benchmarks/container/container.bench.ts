import { describe, bench } from 'vitest';
import { Container } from '../../packages/container/src/index.js';

describe('Dependency Injection Container Benchmarks', () => {
  const container = new Container();

  // Register various lifetimes
  container.registerSingleton('config', () => ({ env: 'production', port: 3000 }));
  container.registerTransient('transientService', () => ({ id: Math.random() }));
  container.registerScoped('scopedService', () => ({ id: Math.random() }));
  container.register(
    'factoryService',
    (c) => ({
      config: c.resolve('config'),
      transient: c.resolve('transientService'),
    }),
    'transient'
  );

  const scope = container.createScope();

  describe('Container Resolution', () => {
    bench('resolve singleton (cached)', () => {
      container.resolve('config');
    });

    bench('resolve transient', () => {
      container.resolve('transientService');
    });

    bench('resolve scoped within active scope', () => {
      scope.resolve('scopedService');
    });

    bench('resolve composite factory service', () => {
      container.resolve('factoryService');
    });

    bench('create and dispose child scope', async () => {
      const s = container.createScope();
      s.resolve('scopedService');
      await s.dispose();
    });
  });
});
