import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@jsango/migrations';

export class MigrateStatusCommand extends BaseCommand {
  public readonly name = 'migrate:status';
  public readonly description = 'Show current migration status and pending migrations';
  public readonly usage = 'jsango migrate:status [options]';
  public readonly options = [
    {
      name: 'connection',
      short: 'c',
      description: 'Database connection name',
      type: 'string' as const,
      default: 'default',
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const db = await context.getDatabaseManager();
    if (!db) {
      context.output.error('No database configured for this application.');
      return ExitCode.DATABASE_ERROR;
    }

    const connectionName = (context.options['connection'] as string) || 'default';
    const runner = new MigrationRunner({
      databaseManager: db,
      registry: context.getMigrationRegistry(),
    });

    try {
      const status = await runner.status(connectionName);

      if (context.output.isJson) {
        context.output.json({
          connection: connectionName,
          isUpToDate: status.isUpToDate,
          latestBatch: status.latestBatch,
          currentVersion: status.currentVersion,
          applied: status.applied,
          pending: status.pending.map((m) => ({ id: m.id, name: m.name })),
        });
        return ExitCode.SUCCESS;
      }

      const { colors } = context.output;
      context.output.text(colors.bold(`Migration Status [${connectionName}]`));
      context.output.text(`  Current Version: ${status.currentVersion ?? 'none'}`);
      context.output.text(`  Latest Batch:    ${status.latestBatch}`);
      context.output.text(
        `  Status:          ${status.isUpToDate ? colors.green('Up to date') : colors.yellow('Pending migrations')}`
      );
      context.output.text();

      if (status.applied.length > 0) {
        context.output.text(colors.bold('Applied Migrations:'));
        const appliedRows = status.applied.map((a) => [
          colors.green('✓'),
          a.id,
          String(a.batch),
          a.appliedAt,
        ]);
        context.output.table(['', 'Migration ID', 'Batch', 'Applied At'], appliedRows);
        context.output.text();
      }

      if (status.pending.length > 0) {
        context.output.text(colors.bold('Pending Migrations:'));
        const pendingRows = status.pending.map((p) => [colors.yellow('○'), p.id, p.name]);
        context.output.table(['', 'Migration ID', 'Name'], pendingRows);
      } else {
        context.output.text('No pending migrations.');
      }

      return ExitCode.SUCCESS;
    } catch (err) {
      context.output.error(
        `Failed to retrieve migration status: ${err instanceof Error ? err.message : String(err)}`
      );
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
