import { CommandRegistry } from './registry.js';
import type { ICommand } from './types.js';
import { ExitCode } from './types.js';
import { CliOutput } from './output.js';
import { CommandContext } from './context.js';
import { ArgParser } from './parser.js';
import { CliError, CommandNotFoundError, InterruptedError } from './errors.js';
import type { ICommandProvider } from './provider.js';

// Built-in commands
import { VersionCommand } from '../commands/version.js';
import { HelpCommand } from '../commands/help.js';
import { DoctorCommand } from '../commands/doctor.js';
import { RouteListCommand } from '../commands/route-list.js';
import { ModelListCommand } from '../commands/model-list.js';
import { ModelShowCommand } from '../commands/model-show.js';
import { ConfigShowCommand } from '../commands/config-show.js';
import { DbStatusCommand } from '../commands/db-status.js';
import { MigrateRunCommand } from '../commands/migrate-run.js';
import { MigrateStatusCommand } from '../commands/migrate-status.js';
import { MigrateRollbackCommand } from '../commands/migrate-rollback.js';
import { MigrateGenerateCommand } from '../commands/migrate-generate.js';
import { MigrateCheckCommand } from '../commands/migrate-check.js';
import { ProjectCreateCommand } from '../commands/project-create.js';
import { CacheClearCommand } from '../commands/cache-clear.js';
import { QueueWorkCommand } from '../commands/queue-work.js';
import { QueueStatusCommand } from '../commands/queue-status.js';
import { QueueFailedCommand } from '../commands/queue-failed.js';
import { QueueRetryCommand } from '../commands/queue-retry.js';
import { QueueClearCommand } from '../commands/queue-clear.js';
import { EventsListCommand } from '../commands/events-list.js';
import { WsStatusCommand } from '../commands/ws-status.js';

export interface CliApplicationOptions {
  readonly registry?: CommandRegistry | undefined;
}

export class CliApplication {
  public readonly registry: CommandRegistry;

  public constructor(options: CliApplicationOptions = {}) {
    this.registry = options.registry ?? new CommandRegistry();
  }

  public static createDefault(): CliApplication {
    const app = new CliApplication();
    const { registry } = app;

    // Register foundational commands
    registry.register(new VersionCommand());
    registry.register(new HelpCommand(registry));
    registry.register(new DoctorCommand());

    // Register inspection commands
    registry.register(new RouteListCommand());
    registry.register(new ModelListCommand());
    registry.register(new ModelShowCommand());
    registry.register(new ConfigShowCommand());
    registry.register(new DbStatusCommand());

    // Register migration commands
    registry.register(new MigrateRunCommand());
    registry.register(new MigrateStatusCommand());
    registry.register(new MigrateRollbackCommand());
    registry.register(new MigrateGenerateCommand());
    registry.register(new MigrateCheckCommand());

    // Register scaffolding commands
    registry.register(new ProjectCreateCommand());

    // Register cache & queue commands
    registry.register(new CacheClearCommand());
    registry.register(new QueueWorkCommand());
    registry.register(new QueueStatusCommand());
    registry.register(new QueueFailedCommand());
    registry.register(new QueueRetryCommand());
    registry.register(new QueueClearCommand());

    // Register events & websocket commands
    registry.register(new EventsListCommand());
    registry.register(new WsStatusCommand());

    return app;
  }

  public registerCommand(command: ICommand): this {
    this.registry.register(command);
    return this;
  }

  public registerProvider(provider: ICommandProvider): this {
    provider.registerCommands(this.registry);
    return this;
  }

  public async run(
    argv: readonly string[] = process.argv.slice(2),
    outputOverride?: CliOutput
  ): Promise<number> {
    const { globals, remaining } = ArgParser.parseGlobalOptions(argv);

    let output: CliOutput;
    if (outputOverride) {
      output = outputOverride;
      if (globals.json) output.setMode('json');
      else if (globals.quiet) output.setMode('quiet');
      if (globals.verbose) output.setVerbose(true);
      if (globals.noColor) output.setColor(false);
    } else {
      output = new CliOutput({
        mode: globals.json ? 'json' : globals.quiet ? 'quiet' : 'text',
        verbose: globals.verbose,
        color: globals.noColor ? false : undefined,
      });
    }

    // Cancellation support via AbortController
    const abortController = new AbortController();
    let currentContext: CommandContext | undefined;

    const cleanupAndExit = async () => {
      abortController.abort();
      if (currentContext) {
        await currentContext.cleanup();
      }
    };

    const sigintHandler = () => {
      output.warn('\nOperation interrupted by user (SIGINT).');
      void cleanupAndExit();
      process.exit(ExitCode.INTERRUPTED);
    };

    const sigtermHandler = () => {
      output.warn('\nProcess terminated (SIGTERM).');
      void cleanupAndExit();
      process.exit(ExitCode.INTERRUPTED);
    };

    if (typeof process !== 'undefined') {
      process.once('SIGINT', sigintHandler);
      process.once('SIGTERM', sigtermHandler);
    }

    try {
      // Fast path: --version
      if (globals.version && remaining.length === 0) {
        const versionCmd = this.registry.resolve('version')!;
        const ctx = new CommandContext({ output, signal: abortController.signal });
        return (await versionCmd.execute(ctx)) ?? ExitCode.SUCCESS;
      }

      // Fast path: no command or --help with no command
      if (remaining.length === 0 || (globals.help && remaining.length === 0)) {
        const helpCmd = this.registry.resolve('help')!;
        const ctx = new CommandContext({ output, signal: abortController.signal });
        return (await helpCmd.execute(ctx)) ?? ExitCode.SUCCESS;
      }

      // Resolve command (support space-delimited namespace: "migrate status" -> "migrate:status")
      let commandName = remaining[0]!;
      let commandArgv = remaining.slice(1);

      if (!this.registry.has(commandName) && remaining.length > 1) {
        const compositeName = `${commandName}:${remaining[1]}`;
        if (this.registry.has(compositeName)) {
          commandName = compositeName;
          commandArgv = remaining.slice(2);
        }
      }

      const command = this.registry.resolve(commandName);
      if (!command) {
        const suggestion = this.registry.findClosestCommand(commandName);
        throw new CommandNotFoundError(commandName, suggestion);
      }

      // If --help was requested for this command: invoke help <command>
      if (globals.help) {
        const helpCmd = this.registry.resolve('help')!;
        const ctx = new CommandContext({
          args: [command.name],
          output,
          signal: abortController.signal,
        });
        return (await helpCmd.execute(ctx)) ?? ExitCode.SUCCESS;
      }

      // Parse command-specific arguments and options
      const parsed = ArgParser.parse(commandArgv, command.arguments, command.options);

      currentContext = new CommandContext({
        args: parsed.args,
        options: parsed.options,
        rawArgs: argv,
        output,
        signal: abortController.signal,
        env: globals.env,
      });

      const result = await command.execute(currentContext);
      await currentContext.cleanup();

      return typeof result === 'number' ? result : ExitCode.SUCCESS;
    } catch (err: unknown) {
      if (err instanceof InterruptedError) {
        output.warn('Operation interrupted.');
        return ExitCode.INTERRUPTED;
      }

      if (err instanceof CliError) {
        output.error(err.message, err);
        return err.exitCode;
      }

      output.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, err);
      return ExitCode.GENERAL_ERROR;
    } finally {
      if (typeof process !== 'undefined' && process.removeListener) {
        process.removeListener('SIGINT', sigintHandler);
        process.removeListener('SIGTERM', sigtermHandler);
      }
    }
  }
}
