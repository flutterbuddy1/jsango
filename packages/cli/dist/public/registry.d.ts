import type { ICommand } from './types.js';
export declare class CommandRegistry {
    private readonly commands;
    private readonly aliasMap;
    /**
     * Registers a command into the registry.
     */
    register(command: ICommand): this;
    /**
     * Registers multiple commands deterministically.
     */
    registerAll(commands: readonly ICommand[]): this;
    /**
     * Unregisters a command by name or alias.
     */
    unregister(name: string): boolean;
    /**
     * Resolves a command by its primary name or alias.
     */
    resolve(name: string): ICommand | undefined;
    /**
     * Checks whether a command or alias is registered.
     */
    has(name: string): boolean;
    /**
     * Returns all registered commands, sorted alphabetically for determinism.
     */
    list(namespace?: string): readonly ICommand[];
    /**
     * Returns all unique namespaces.
     */
    getNamespaces(): readonly string[];
    /**
     * Finds the closest command name using Levenshtein distance for suggestions.
     */
    findClosestCommand(name: string): string | undefined;
    /**
     * Clears all registered commands and aliases.
     */
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map