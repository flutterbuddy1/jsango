import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@django-js/migrations';
import { DestructiveOperationError } from '../public/errors.js';

export class MigrateRollbackCommand extends BaseCommand {
  public readonly name = 'migrate:rollback';
  public readonly description = 'Rollback applied database migrations';
  public readonly usage = 'django-js migrate:rollback [options]';
  public readonly options = [
    {
      name: 'connection',
      short: 'c',
      description: 'Database connection name',
      type: 'string' as const,
      default: 'default',
    },
    {
      name: 'steps',
      short: 's',
      description: 'Number of migration steps to rollback',
      type: 'number' as const,
    },
    {
      name: 'target',
      short: 't',
      description: 'Rollback all migrations after this target ID',
      type: 'string' as const,
    },
    {
      name: 'yes',
      short: 'y',
      description: 'Auto-confirm irreversible/destructive rollback operations',
      type: 'boolean' as const,
    },
    {
      name: 'force',
      description: 'Force execution of irreversible/destructive rollback operations',
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
    const steps = context.options['steps'] as number | undefined;
    const target = context.options['target'] as string | undefined;
    const allowDestructive = Boolean(context.options['yes'] || context.options['force']);

    const runner = new MigrationRunner({
      databaseManager: db,
      registry: context.getMigrationRegistry(),
    });

    try {
      const result = await runner.rollback({
        connection: connectionName,
        steps,
        target,
        allowDestructive,
      });

      if (context.output.isJson) {
        context.output.json(result);
        return ExitCode.SUCCESS;
      }

      if (result.rolledBack.length === 0) {
        context.output.text('No migrations to rollback.');
        return ExitCode.SUCCESS;
      }

      const { colors } = context.output;
      context.output.success(`Rolled back ${result.rolledBack.length} migration(s):`);
      for (const id of result.rolledBack) {
        context.output.text(`  ${colors.yellow('↶')} ${id}`);
      }

      return ExitCode.SUCCESS;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'IrreversibleMigrationError') {
        throw new DestructiveOperationError(
          `Migration rollback contains irreversible operations (${err.message}).`
        );
      }
      context.output.error(
        `Migration rollback failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
