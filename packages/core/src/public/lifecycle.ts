export type ApplicationState = 'idle' | 'booting' | 'running' | 'stopping' | 'stopped';

export type LifecycleHook = () => Promise<void> | void;

export interface IApplicationLifecycle {
  readonly state: ApplicationState;
  onBoot(hook: LifecycleHook): void;
  onReady(hook: LifecycleHook): void;
  onShutdown(hook: LifecycleHook): void;
  boot(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * True unless `NODE_ENV` is `development` or `test`. Fails closed: a server started without
 * `NODE_ENV` (common in Docker / PM2) gets production behaviour (generic errors, secure cookies,
 * no default admin password).
 */
export function isProductionEnv(): boolean {
  const env = process.env['NODE_ENV'];
  return env !== 'development' && env !== 'test';
}
