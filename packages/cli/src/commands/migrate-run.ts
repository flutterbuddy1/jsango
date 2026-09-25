import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@jsango/migrations';
import { DestructiveOperationError } from '../public/errors.js';

export class MigrateRunCommand extends BaseCommand {
  public readonly name = 'migrate:run';
  public readonly description = 'Execute pending database migrations';
  public readonly usage = 'jsango migrate:run [options]';
  public readonly aliases = ['migrate'];
  public readonly options = [
    {
      name: 'connection',
      short: 'c',
      description: 'Database connection name',
      type: 'string' as const,
      default: 'default',
    },
    {
      name: 'target',
      short: 't',
      description: 'Target migration ID to migrate up to',
      type: 'string' as const,
    },
    {
      name: 'yes',
      short: 'y',
      description: 'Auto-confirm destructive migration operations',
      type: 'boolean' as const,
    },
    {
      name: 'force',
      description: 'Force execution of destructive migration operations',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const db = await context.getDatabaseManager();
    if (!db) {
      context.output.error('No database configured for this application.');
      return ExitCode.DATABASE_ERROR;
    }

    const connectionName = (context.options['connection'] as string) || 'default';
    const target = context.options['target'] as string | undefined;
    const allowDestructive = Boolean(context.options['yes'] || context.options['force']);

    const runner = new MigrationRunner({
      databaseManager: db,
      registry: context.getMigrationRegistry(),
    });

    try {
      const result = await runner.migrate({
        connection: connectionName,
        target,
        allowDestructive,
      });

      if (context.output.isJson) {
        context.output.json(result);
        return ExitCode.SUCCESS;
      }

      if (result.applied.length === 0) {
        context.output.text('Nothing to migrate. Database schema is already up to date.');
        return ExitCode.SUCCESS;
      }

      const { colors } = context.output;
      context.output.success(
        `Applied ${result.applied.length} migration(s) in batch #${result.batch}:`
      );
      for (const id of result.applied) {
        context.output.text(`  ${colors.green('✓')} ${id}`);
      }

      return ExitCode.SUCCESS;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'DestructiveMigrationError') {
        throw new DestructiveOperationError(err.message);
      }
      context.output.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
