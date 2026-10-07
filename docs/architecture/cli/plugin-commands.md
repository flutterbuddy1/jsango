# Plugin Commands & Extension Architecture

## Overview

Future jsango packages (e.g., Admin, Queue, Cache, WebSockets) and third-party extensions need to register CLI commands without monkey-patching or modifying core framework packages.

## The `ICommandProvider` Contract

Extensions implement `ICommandProvider`:

```typescript
import type { CommandRegistry } from '@jsango/cli';

export interface ICommandProvider {
  readonly name: string;
  registerCommands(registry: CommandRegistry): void;
}
```

## Example: Future Admin Package Command Provider

```typescript
import {
  type ICommandProvider,
  type CommandRegistry,
  type CommandContext,
  BaseCommand,
  ExitCode,
} from '@jsango/cli';

class AdminRoutesCommand extends BaseCommand {
  public readonly name = 'admin:routes';
  public readonly description = 'Inspect registered admin panel endpoints';

  public execute(context: CommandContext): number {
    context.output.text('Admin routes: /admin, /admin/login, /admin/metrics');
    return ExitCode.SUCCESS;
  }
}

export class AdminCommandProvider implements ICommandProvider {
  public readonly name = 'admin';

  public registerCommands(registry: CommandRegistry): void {
    registry.register(new AdminRoutesCommand());
  }
}
```

Applications can register providers cleanly:

```typescript
import { CliApplication } from '@jsango/cli';

const app = CliApplication.createDefault();
app.registerProvider(new AdminCommandProvider());
await app.run();
```
