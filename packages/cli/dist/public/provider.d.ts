import type { CommandRegistry } from './registry.js';
export interface ICommandProvider {
    readonly name: string;
    registerCommands(registry: CommandRegistry): void;
}
//# sourceMappingURL=provider.d.ts.map