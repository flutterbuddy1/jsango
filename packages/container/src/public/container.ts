export type ServiceIdentifier<T = unknown> =
  string | symbol | (new (...args: unknown[]) => T) | (abstract new (...args: unknown[]) => T);

export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

export type ServiceFactory<T = unknown> = (container: IContainer) => T;

export interface IContainer {
  register<T>(
    id: ServiceIdentifier<T>,
    instanceOrFactory: T | ServiceFactory<T>,
    lifetime?: ServiceLifetime
  ): void;
  resolve<T>(id: ServiceIdentifier<T>): T;
  has(id: ServiceIdentifier<unknown>): boolean;
  createScope(): IContainer;
}
