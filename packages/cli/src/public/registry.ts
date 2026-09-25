import type { ICommand } from './types.js';
import { findClosest } from '../internal/leven.js';

export class CommandRegistry {
  private readonly commands = new Map<string, ICommand>();
  private readonly aliasMap = new Map<string, string>();

  /**
   * Registers a command into the registry.
   */
  public register(command: ICommand): this {
    const name = command.name.toLowerCase();

    if (this.commands.has(name)) {
      throw new Error(`Command "${name}" is already registered.`);
    }

    if (this.aliasMap.has(name)) {
      throw new Error(`Cannot register command "${name}": already registered as an alias.`);
    }

    this.commands.set(name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        const lowerAlias = alias.toLowerCase();
        if (this.commands.has(lowerAlias) || this.aliasMap.has(lowerAlias)) {
          throw new Error(
            `Alias "${alias}" for command "${name}" conflicts with an existing command or alias.`
          );
        }
        this.aliasMap.set(lowerAlias, name);
      }
    }

    return this;
  }

  /**
   * Registers multiple commands deterministically.
   */
  public registerAll(commands: readonly ICommand[]): this {
    for (const cmd of commands) {
      this.register(cmd);
    }
    return this;
  }

  /**
   * Unregisters a command by name or alias.
   */
  public unregister(name: string): boolean {
    const lower = name.toLowerCase();
    const resolvedName = this.aliasMap.get(lower) ?? lower;

    const cmd = this.commands.get(resolvedName);
    if (!cmd) {
      return false;
    }

    this.commands.delete(resolvedName);

    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliasMap.delete(alias.toLowerCase());
      }
    }

    return true;
  }

  /**
   * Resolves a command by its primary name or alias.
   */
  public resolve(name: string): ICommand | undefined {
    const lower = name.toLowerCase();
    const primaryName = this.aliasMap.get(lower) ?? lower;
    return this.commands.get(primaryName);
  }

  /**
   * Checks whether a command or alias is registered.
   */
  public has(name: string): boolean {
    const lower = name.toLowerCase();
    return this.commands.has(lower) || this.aliasMap.has(lower);
  }

  /**
   * Returns all registered commands, sorted alphabetically for determinism.
   */
  public list(namespace?: string): readonly ICommand[] {
    const all = [...this.commands.values()];

    const filtered = namespace
      ? all.filter((cmd) => {
          const colonIdx = cmd.name.indexOf(':');
          if (colonIdx === -1) {
            return namespace === 'root';
          }
          return cmd.name.slice(0, colonIdx) === namespace;
        })
      : all;

    return Object.freeze(filtered.sort((a, b) => a.name.localeCompare(b.name)));
  }

  /**
   * Returns all unique namespaces.
   */
  public getNamespaces(): readonly string[] {
    const namespaces = new Set<string>();

    for (const name of this.commands.keys()) {
      const colonIdx = name.indexOf(':');
      if (colonIdx !== -1) {
        namespaces.add(name.slice(0, colonIdx));
      }
    }

    return Object.freeze([...namespaces].sort());
  }

  /**
   * Finds the closest command name using Levenshtein distance for suggestions.
   */
  public findClosestCommand(name: string): string | undefined {
    const candidates = [...this.commands.keys(), ...this.aliasMap.keys()];
    return findClosest(name, candidates);
  }

  /**
   * Clears all registered commands and aliases.
   */
  public clear(): void {
    this.commands.clear();
    this.aliasMap.clear();
  }
}
