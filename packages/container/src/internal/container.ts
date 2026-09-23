import type {
  IContainer,
  ServiceIdentifier,
  ServiceLifetime,
  ServiceFactory,
} from '../public/container.js';
import {
  ServiceNotFoundError,
  CircularDependencyError,
  ContainerDisposedError,
} from '../public/errors.js';

interface Binding<T = unknown> {
  readonly lifetime: ServiceLifetime;
  readonly factory: ServiceFactory<T>;
}

export class Container implements IContainer {
  private readonly parent?: Container | undefined;
  private readonly bindings = new Map<ServiceIdentifier<unknown>, Binding>();
  private readonly instances = new Map<ServiceIdentifier<unknown>, unknown>();
  private readonly resolvingStack = new Set<ServiceIdentifier<unknown>>();
  private readonly disposables = new Set<() => Promise<void> | void>();
  private _isDisposed = false;

  constructor(parent?: Container) {
    this.parent = parent;
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public register<T>(
    id: ServiceIdentifier<T>,
    instanceOrFactory: T | ServiceFactory<T>,
    lifetime: ServiceLifetime = 'singleton'
  ): void {
    this.assertNotDisposed();

    if (typeof instanceOrFactory === 'function') {
      this.bindings.set(id as ServiceIdentifier<unknown>, {
        lifetime,
        factory: instanceOrFactory as ServiceFactory<T>,
      });
    } else {
      // Fixed instance: register as singleton
      this.bindings.set(id as ServiceIdentifier<unknown>, {
        lifetime: 'singleton',
        factory: () => instanceOrFactory,
      });
      this.instances.set(id as ServiceIdentifier<unknown>, instanceOrFactory);
    }
  }

  public registerInstance<T>(id: ServiceIdentifier<T>, instance: T): void {
    this.register(id, instance, 'singleton');
  }

  public registerSingleton<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register(id, factory, 'singleton');
  }

  public registerScoped<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register(id, factory, 'scoped');
  }

  public registerTransient<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register(id, factory, 'transient');
  }

  public onDispose(callback: () => Promise<void> | void): void {
    this.assertNotDisposed();
    this.disposables.add(callback);
  }

  public resolve<T>(id: ServiceIdentifier<T>): T {
    this.assertNotDisposed();

    // Check circular dependencies
    if (this.resolvingStack.has(id as ServiceIdentifier<unknown>)) {
      const chain = Array.from(this.resolvingStack).map((s) =>
        typeof s === 'function' ? s.name : String(s)
      );
      const target = typeof id === 'function' ? id.name : String(id);
      chain.push(target);
      throw new CircularDependencyError(chain);
    }

    // 1. Look for binding locally or in parent
    const binding = this.findBinding(id as ServiceIdentifier<unknown>);
    if (!binding) {
      throw new ServiceNotFoundError(id as ServiceIdentifier<unknown>);
    }

    // 2. Resolve based on lifetime
    if (binding.lifetime === 'singleton') {
      if (this.parent) {
        return this.parent.resolve(id);
      }
      if (this.instances.has(id as ServiceIdentifier<unknown>)) {
        return this.instances.get(id as ServiceIdentifier<unknown>) as T;
      }
      const instance = this.createInstance(id as ServiceIdentifier<unknown>, binding.factory);
      this.instances.set(id as ServiceIdentifier<unknown>, instance);
      return instance as T;
    }

    if (binding.lifetime === 'scoped') {
      if (this.instances.has(id as ServiceIdentifier<unknown>)) {
        return this.instances.get(id as ServiceIdentifier<unknown>) as T;
      }
      const instance = this.createInstance(id as ServiceIdentifier<unknown>, binding.factory);
      this.instances.set(id as ServiceIdentifier<unknown>, instance);
      return instance as T;
    }

    // Transient lifetime
    return this.createInstance(id as ServiceIdentifier<unknown>, binding.factory) as T;
  }

  public has(id: ServiceIdentifier<unknown>): boolean {
    if (this.bindings.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public createScope(): Container {
    this.assertNotDisposed();
    return new Container(this);
  }

  public async dispose(): Promise<void> {
    if (this._isDisposed) return;
    this._isDisposed = true;

    // Run registered disposables
    const callbacks = Array.from(this.disposables);
    this.disposables.clear();
    for (const cb of callbacks) {
      await cb();
    }

    // Run instance-level dispose() methods if present
    for (const instance of this.instances.values()) {
      if (instance && typeof instance === 'object') {
        const disposable = instance as { dispose?: () => Promise<void> | void };
        if (typeof disposable.dispose === 'function') {
          await disposable.dispose();
        }
      }
    }

    this.instances.clear();
    this.bindings.clear();
  }

  private findBinding(id: ServiceIdentifier<unknown>): Binding | undefined {
    if (this.bindings.has(id)) {
      return this.bindings.get(id);
    }
    return this.parent?.findBinding(id);
  }

  private createInstance<T>(id: ServiceIdentifier<unknown>, factory: ServiceFactory<T>): T {
    this.resolvingStack.add(id);
    try {
      return factory(this);
    } finally {
      this.resolvingStack.delete(id);
    }
  }

  private assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new ContainerDisposedError();
    }
  }
}
