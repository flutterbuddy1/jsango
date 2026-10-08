import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@jsango/migrations';
import { DestructiveOperationError } from '../public/errors.js';
import { CONNECTION_OPTION, connectionOption, requireDatabase } from '../internal/db-command.js';

export class MigrateRunCommand extends BaseCommand {
  public readonly name = 'migrate:run';
  public readonly description = 'Apply pending database migrations';
  public readonly usage = 'jsango migrate [options]';
  public readonly aliases = ['migrate'];
  public readonly options = [
    CONNECTION_OPTION,
    {
      name: 'target',
      short: 't',
      description: 'Migrate up to (and including) this migration ID',
      type: 'string' as const,
    },
    {
      name: 'dry-run',
      description: 'Print the SQL that would run without changing the database',
      type: 'boolean' as const,
    },
    {
      name: 'yes',
      short: 'y',
      description: 'Confirm destructive operations (DROP TABLE / DROP COLUMN / type changes)',
      type: 'boolean' as const,
    },
    {
      name: 'force',
      description: 'Alias of --yes',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const db = await requireDatabase(context);
    if (!db) {
      return ExitCode.DATABASE_ERROR;
    }

    const connection = connectionOption(context);
    const target = context.options['target'] as string | undefined;
    const allowDestructive = Boolean(context.options['yes'] || context.options['force']);
    const dryRun = Boolean(context.options['dry-run'] ?? context.options['dryRun']);
    const { colors } = context.output;

    const runner = new MigrationRunner({
      databaseManager: db,
      registry: context.getMigrationRegistry(),
      onProgress: (event) => {
        if (!context.output.isJson) {
          context.output.text(
            `  ${colors.green('✓')} ${event.id} ${colors.dim(`(${event.durationMs}ms)`)}`
          );
        }
      },
    });

    try {
      const connName = runner.resolveConnection(connection);

      if (dryRun) {
        const plan = await runner.plan({ connection, target });
        if (context.output.isJson) {
          context.output.json({ connection: connName, dialect: runner.getDialect(connName), plan });
          return ExitCode.SUCCESS;
        }
        if (plan.length === 0) {
          context.output.text('Nothing to migrate. Database schema is already up to date.');
          return ExitCode.SUCCESS;
        }
        context.output.text(
          colors.bold(
            `${plan.length} pending migration(s) on [${connName}] (${runner.getDialect(connName)}):`
          )
        );
        for (const step of plan) {
          context.output.text();
          context.output.text(
            `${colors.cyan(`-- ${step.id}`)}${step.isDestructive ? ' ' + colors.yellow('[DESTRUCTIVE]') : ''}`
          );
          if (step.statements.length === 0) {
            context.output.text(
              colors.dim('-- (custom migration: SQL issued via ctx.sql() is not shown)')
            );
          }
          for (const statement of step.statements) {
            context.output.text(statement);
          }
        }
        return ExitCode.SUCCESS;
      }

      if (!context.output.isJson) {
        context.output.text(`Running migrations on [${connName}]...`);
      }

      const result = await runner.migrate({ connection, target, allowDestructive });

      if (context.output.isJson) {
        context.output.json(result);
        return ExitCode.SUCCESS;
      }

      if (result.applied.length === 0) {
        context.output.text('Nothing to migrate. Database schema is already up to date.');
        return ExitCode.SUCCESS;
      }

      context.output.success(
        `Applied ${result.applied.length} migration(s) in batch #${result.batch}.`
      );
      return ExitCode.SUCCESS;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'DestructiveMigrationError') {
        throw new DestructiveOperationError(
          `${err.message}\nPreview the SQL with "jsango migrate --dry-run", then re-run with --yes.`
        );
      }
      context.output.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
