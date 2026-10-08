import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@jsango/migrations';
import { DestructiveOperationError } from '../public/errors.js';
import { CONNECTION_OPTION, connectionOption, requireDatabase } from '../internal/db-command.js';

export class MigrateResetCommand extends BaseCommand {
  public readonly name = 'migrate:reset';
  public readonly description = 'Roll back ALL migrations (optionally re-apply them with --fresh)';
  public readonly usage = 'jsango migrate:reset --yes [--fresh]';
  public readonly options = [
    CONNECTION_OPTION,
    {
      name: 'yes',
      short: 'y',
      description: 'Confirm that all tables created by migrations (and their data) will be dropped',
      type: 'boolean' as const,
    },
    {
      name: 'fresh',
      description: 'Re-run all migrations after resetting',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    if (!context.options['yes']) {
      throw new DestructiveOperationError(
        'migrate:reset drops every table created by migrations and all of its data. Re-run with --yes to confirm.'
      );
    }
    if (context.env === 'production' && !process.env['JSANGO_ALLOW_PRODUCTION_RESET']) {
      throw new DestructiveOperationError(
        'Refusing to reset a production database. Set JSANGO_ALLOW_PRODUCTION_RESET=1 if you really mean it.'
      );
    }

    const db = await requireDatabase(context);
    if (!db) return ExitCode.DATABASE_ERROR;

    const runner = new MigrationRunner({
      databaseManager: db,
      registry: context.getMigrationRegistry(),
    });
    const connection = connectionOption(context);
    try {
      const reset = await runner.reset({ confirm: 'YES_I_AM_SURE', connection });
      const applied = context.options['fresh']
        ? (await runner.migrate({ connection, allowDestructive: true })).applied
        : [];

      if (context.output.isJson) {
        context.output.json({ rolledBack: reset.rolledBack, applied });
      } else {
        context.output.success(`Rolled back ${reset.rolledBack.length} migration(s).`);
        if (context.options['fresh']) {
          context.output.success(`Re-applied ${applied.length} migration(s).`);
        }
      }
      return ExitCode.SUCCESS;
    } catch (err) {
      context.output.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
