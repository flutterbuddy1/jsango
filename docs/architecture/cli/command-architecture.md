# Command Architecture

## Design Overview

`@jsango/cli` employs a declarative, strongly-typed command abstraction. Commands are lightweight descriptors coupled with execution handlers, avoiding monolithic god-classes.

```
Command
  ↓
CommandDefinition
  ↓
CommandHandler(CommandContext)
```

## Core Abstractions

### 1. `ICommand` & `CommandDefinition`

Every command implements `ICommand` which combines metadata and execution logic:

```typescript
export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly arguments?: readonly ArgumentDefinition[] | undefined;
  readonly options?: readonly OptionDefinition[] | undefined;
  readonly examples?: readonly CommandExample[] | undefined;
  readonly hidden?: boolean | undefined;
}

export interface ICommand extends CommandDefinition {
  execute(context: CommandContext): Promise<number | void> | number | void;
}
```

### 2. `BaseCommand` & `defineCommand`

Developers can author commands by extending `BaseCommand` or using the functional `defineCommand` helper:

```typescript
export class VersionCommand extends BaseCommand {
  public readonly name = 'version';
  public readonly description = 'Display the framework and CLI version';
  public readonly aliases = ['-v', '--version'];

  public execute(context: CommandContext): number {
    context.output.text(`jsango v${FRAMEWORK_VERSION}`);
    return ExitCode.SUCCESS;
  }
}
```

### 3. Separation of Concerns

CLI commands act solely as orchestrators. They:

- Parse and validate CLI inputs.
- Interact with `CommandContext` for environment and configuration state.
- Delegate actual database, migration, routing, and ORM operations to their respective packages.
- Format results through `CliOutput`.
