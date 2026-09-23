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
