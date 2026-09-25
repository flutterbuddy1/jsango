import type { CommandRegistry } from './registry.js';

export interface ICommandProvider {
  readonly name: string;
  registerCommands(registry: CommandRegistry): void;
}
