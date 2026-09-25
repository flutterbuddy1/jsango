import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../public/registry.js';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';

class MockMigrateCommand extends BaseCommand {
  public readonly name = 'migrate:run';
  public readonly description = 'Run migrations';
  public readonly aliases = ['migrate'];

  public execute(_context: CommandContext): number {
    return 0;
  }
}

class MockRoutesCommand extends BaseCommand {
  public readonly name = 'route:list';
  public readonly description = 'List routes';
  public readonly aliases = ['routes'];

  public execute(_context: CommandContext): number {
    return 0;
  }
}

describe('CommandRegistry', () => {
  it('should register and resolve commands by primary name and alias', () => {
    const registry = new CommandRegistry();
    const cmd = new MockMigrateCommand();

    registry.register(cmd);

    expect(registry.has('migrate:run')).toBe(true);
    expect(registry.has('migrate')).toBe(true);
    expect(registry.resolve('migrate:run')).toBe(cmd);
    expect(registry.resolve('migrate')).toBe(cmd);
    expect(registry.resolve('unknown')).toBeUndefined();
  });

  it('should reject duplicate command names and conflicting aliases', () => {
    const registry = new CommandRegistry();
    registry.register(new MockMigrateCommand());

    expect(() => registry.register(new MockMigrateCommand())).toThrow(
      'Command "migrate:run" is already registered.'
    );

    class ConflictAliasCommand extends BaseCommand {
      public readonly name = 'other:cmd';
      public readonly description = 'Other';
      public readonly aliases = ['migrate'];

      public execute(_context: CommandContext): number {
        return 0;
      }
    }

    expect(() => registry.register(new ConflictAliasCommand())).toThrow(
      'conflicts with an existing command or alias.'
    );
  });

  it('should filter commands by namespace and sort deterministically', () => {
    const registry = new CommandRegistry();
    registry.register(new MockMigrateCommand());
    registry.register(new MockRoutesCommand());

    const all = registry.list();
    expect(all.map((c) => c.name)).toEqual(['migrate:run', 'route:list']);

    const migrateOnly = registry.list('migrate');
    expect(migrateOnly.map((c) => c.name)).toEqual(['migrate:run']);

    expect(registry.getNamespaces()).toEqual(['migrate', 'route']);
  });

  it('should unregister commands and aliases properly', () => {
    const registry = new CommandRegistry();
    registry.register(new MockMigrateCommand());

    expect(registry.unregister('migrate:run')).toBe(true);
    expect(registry.has('migrate:run')).toBe(false);
    expect(registry.has('migrate')).toBe(false);
    expect(registry.resolve('migrate:run')).toBeUndefined();
  });

  it('should find closest command for typos', () => {
    const registry = new CommandRegistry();
    registry.register(new MockMigrateCommand());
    registry.register(new MockRoutesCommand());

    expect(registry.findClosestCommand('rout:list')).toBe('route:list');
    expect(registry.findClosestCommand('migrat')).toBe('migrate');
  });
});
