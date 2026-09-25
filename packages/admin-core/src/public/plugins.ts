import type { AdminRegistry } from './registry.js';

export interface IAdminPlugin {
  readonly id: string;
  readonly name: string;
  readonly version?: string | undefined;
  register(registry: AdminRegistry): Promise<void> | void;
  boot?(registry: AdminRegistry): Promise<void> | void;
}
