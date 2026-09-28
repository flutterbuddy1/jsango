import { ServiceNotFoundError, CircularDependencyError, ContainerDisposedError, } from '../public/errors.js';
export class Container {
    parent;
    bindings = new Map();
    instances = new Map();
    resolvingStack = new Set();
    disposables = new Set();
    _isDisposed = false;
    constructor(parent) {
        this.parent = parent;
    }
    get isDisposed() {
        return this._isDisposed;
    }
    register(id, instanceOrFactory, lifetime = 'singleton') {
        this.assertNotDisposed();
        if (typeof instanceOrFactory === 'function') {
            this.bindings.set(id, {
                lifetime,
                factory: instanceOrFactory,
            });
        }
        else {
            // Fixed instance: register as singleton
            this.bindings.set(id, {
                lifetime: 'singleton',
                factory: () => instanceOrFactory,
            });
            this.instances.set(id, instanceOrFactory);
        }
    }
    registerInstance(id, instance) {
        this.register(id, instance, 'singleton');
    }
    registerSingleton(id, factory) {
        this.register(id, factory, 'singleton');
    }
    registerScoped(id, factory) {
        this.register(id, factory, 'scoped');
    }
    registerTransient(id, factory) {
        this.register(id, factory, 'transient');
    }
    onDispose(callback) {
        this.assertNotDisposed();
        this.disposables.add(callback);
    }
    resolve(id) {
        this.assertNotDisposed();
        // 1. Fast path: already instantiated locally (scoped or root singleton)
        const existing = this.instances.get(id);
        if (existing !== undefined) {
            return existing;
        }
        // 2. Check circular dependencies
        if (this.resolvingStack.has(id)) {
            const chain = Array.from(this.resolvingStack).map((s) => typeof s === 'function' ? s.name : String(s));
            const target = typeof id === 'function' ? id.name : String(id);
            chain.push(target);
            throw new CircularDependencyError(chain);
        }
        // 3. Delegate singleton resolution to parent when in child container
        if (this.parent) {
            const binding = this.findBinding(id);
            if (!binding) {
                throw new ServiceNotFoundError(id);
            }
            if (binding.lifetime === 'singleton') {
                return this.parent.resolve(id);
            }
            if (binding.lifetime === 'scoped') {
                const instance = this.createInstance(id, binding.factory);
                this.instances.set(id, instance);
                return instance;
            }
            return this.createInstance(id, binding.factory);
        }
        const binding = this.bindings.get(id);
        if (!binding) {
            throw new ServiceNotFoundError(id);
        }
        if (binding.lifetime === 'singleton' || binding.lifetime === 'scoped') {
            const instance = this.createInstance(id, binding.factory);
            this.instances.set(id, instance);
            return instance;
        }
        return this.createInstance(id, binding.factory);
    }
    has(id) {
        if (this.bindings.has(id))
            return true;
        return this.parent ? this.parent.has(id) : false;
    }
    createScope() {
        this.assertNotDisposed();
        return new Container(this);
    }
    async dispose() {
        if (this._isDisposed)
            return;
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
                const disposable = instance;
                if (typeof disposable.dispose === 'function') {
                    await disposable.dispose();
                }
            }
        }
        this.instances.clear();
        this.bindings.clear();
    }
    findBinding(id) {
        if (this.bindings.has(id)) {
            return this.bindings.get(id);
        }
        return this.parent?.findBinding(id);
    }
    createInstance(id, factory) {
        this.resolvingStack.add(id);
        try {
            return factory(this);
        }
        finally {
            this.resolvingStack.delete(id);
        }
    }
    assertNotDisposed() {
        if (this._isDisposed) {
            throw new ContainerDisposedError();
        }
    }
}
//# sourceMappingURL=container.js.map