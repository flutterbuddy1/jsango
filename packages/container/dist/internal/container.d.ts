import type { IContainer, ServiceIdentifier, ServiceLifetime, ServiceFactory } from '../public/container.js';
export declare class Container implements IContainer {
    private readonly parent?;
    private readonly bindings;
    private readonly instances;
    private readonly resolvingStack;
    private readonly disposables;
    private _isDisposed;
    constructor(parent?: Container);
    get isDisposed(): boolean;
    register<T>(id: ServiceIdentifier<T>, instanceOrFactory: T | ServiceFactory<T>, lifetime?: ServiceLifetime): void;
    registerInstance<T>(id: ServiceIdentifier<T>, instance: T): void;
    registerSingleton<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
    registerScoped<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
    registerTransient<T>(id: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
    onDispose(callback: () => Promise<void> | void): void;
    resolve<T>(id: ServiceIdentifier<T>): T;
    has(id: ServiceIdentifier<unknown>): boolean;
    createScope(): Container;
    dispose(): Promise<void>;
    private findBinding;
    private createInstance;
    private assertNotDisposed;
}
//# sourceMappingURL=container.d.ts.map