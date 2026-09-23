import { describe, it, expect, vi } from 'vitest';
import {
  Container,
  ServiceNotFoundError,
  CircularDependencyError,
  ContainerDisposedError,
} from './index.js';

describe('@django-js/container', () => {
  it('should register and resolve singleton instances', () => {
    const container = new Container();
    container.registerInstance('config', { port: 8080 });

    const config1 = container.resolve('config');
    const config2 = container.resolve('config');

    expect(config1).toEqual({ port: 8080 });
    expect(config1).toBe(config2);
  });

  it('should register and resolve singleton factories once across scopes', () => {
    const root = new Container();
    let counter = 0;
    root.registerSingleton('counter', () => ({ count: ++counter }));

    const scope1 = root.createScope();
    const scope2 = root.createScope();

    const instanceRoot = root.resolve<{ count: number }>('counter');
    const instance1 = scope1.resolve<{ count: number }>('counter');
    const instance2 = scope2.resolve<{ count: number }>('counter');

    expect(instanceRoot.count).toBe(1);
    expect(instance1.count).toBe(1);
    expect(instance2.count).toBe(1);
    expect(instance1).toBe(instanceRoot);
    expect(instance2).toBe(instanceRoot);
  });

  it('should resolve scoped services uniquely per scope and cache within scope', () => {
    const root = new Container();
    let scopeId = 0;
    root.registerScoped('requestLogger', () => ({ id: ++scopeId }));

    const scopeA = root.createScope();
    const scopeB = root.createScope();

    const loggerA1 = scopeA.resolve<{ id: number }>('requestLogger');
    const loggerA2 = scopeA.resolve<{ id: number }>('requestLogger');
    const loggerB1 = scopeB.resolve<{ id: number }>('requestLogger');

    expect(loggerA1.id).toBe(1);
    expect(loggerA2.id).toBe(1);
    expect(loggerA1).toBe(loggerA2);

    expect(loggerB1.id).toBe(2);
    expect(loggerB1).not.toBe(loggerA1);
  });

  it('should resolve transient services afresh every time', () => {
    const container = new Container();
    let instanceCount = 0;
    container.registerTransient('random', () => ({ value: ++instanceCount }));

    const r1 = container.resolve<{ value: number }>('random');
    const r2 = container.resolve<{ value: number }>('random');

    expect(r1.value).toBe(1);
    expect(r2.value).toBe(2);
    expect(r1).not.toBe(r2);
  });

  it('should execute disposal callbacks and instance dispose() on scope disposal', async () => {
    const root = new Container();
    const cleanupCallback = vi.fn();
    const instanceDispose = vi.fn();

    root.registerScoped('disposableService', (c) => {
      const instance = {
        name: 'service',
        dispose: instanceDispose,
      };
      (c as Container).onDispose(cleanupCallback);
      return instance;
    });

    const scope = root.createScope();
    scope.resolve('disposableService');

    expect(cleanupCallback).not.toHaveBeenCalled();
    expect(instanceDispose).not.toHaveBeenCalled();

    await scope.dispose();

    expect(cleanupCallback).toHaveBeenCalledTimes(1);
    expect(instanceDispose).toHaveBeenCalledTimes(1);
    expect(scope.isDisposed).toBe(true);

    // Root container must remain active
    expect(root.isDisposed).toBe(false);
  });

  it('should throw ContainerDisposedError when resolving from disposed container', async () => {
    const container = new Container();
    container.registerInstance('foo', 'bar');
    await container.dispose();

    expect(() => container.resolve('foo')).toThrow(ContainerDisposedError);
  });

  it('should throw ServiceNotFoundError when resolving unregistered service', () => {
    const container = new Container();
    expect(() => container.resolve('unknownService')).toThrow(ServiceNotFoundError);
  });

  it('should detect and throw CircularDependencyError', () => {
    const container = new Container();

    container.registerTransient('A', (c) => {
      return { b: c.resolve('B') };
    });
    container.registerTransient('B', (c) => {
      return { a: c.resolve('A') };
    });

    expect(() => container.resolve('A')).toThrow(CircularDependencyError);
  });
});
