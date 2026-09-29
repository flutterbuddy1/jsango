import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { maskConnectionConfig } from '@jsango/database';
import { CONNECTION_OPTION, connectionOption, requireDatabase } from '../internal/db-command.js';

export class DbStatusCommand extends BaseCommand {
  public readonly name = 'db:status';
  public readonly description = 'Check that each configured database connection works';
  public readonly usage = 'jsango db:status [options]';
  public readonly aliases = ['database:status', 'db:health', 'db:check'];
  public readonly options = [CONNECTION_OPTION];

  public async execute(context: CommandContext): Promise<number> {
    const db = await requireDatabase(context);
    if (!db) {
      return ExitCode.DATABASE_ERROR;
    }

    const requested = connectionOption(context);
    let names: readonly string[];
    try {
      names = requested
        ? [db.resolveConnectionName(requested)]
        : typeof db.connectionNames === 'object'
          ? db.connectionNames
          : ['default'];
    } catch (err) {
      context.output.error(err instanceof Error ? err.message : String(err));
      return ExitCode.DATABASE_ERROR;
    }

    const results = [];
    for (const name of names) {
      const started = Date.now();
      let driver = 'unknown';
      let target = '';
      try {
        const cfg = maskConnectionConfig(db.getConnectionConfig(name));
        driver = db.getDriverName(name);
        target =
          cfg.url ??
          (driver === 'sqlite'
            ? String(cfg.filename ?? cfg.database ?? ':memory:')
            : `${cfg.host ?? '127.0.0.1'}${cfg.port ? `:${cfg.port}` : ''}/${cfg.database ?? ''}`);
      } catch {
        // Mocked managers in tests may not expose configuration details.
      }
      try {
        await db.verify(name);
        results.push({ connection: name, driver, target, status: 'healthy' as const, latencyMs: Date.now() - started });
      } catch (err) {
        results.push({
          connection: name,
          driver,
          target,
          status: 'unhealthy' as const,
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const healthy = results.every((r) => r.status === 'healthy');

    if (context.output.isJson) {
      context.output.json(results.length === 1 ? { ...results[0], responsive: healthy } : results);
      return healthy ? ExitCode.SUCCESS : ExitCode.DATABASE_ERROR;
    }

    const { colors } = context.output;
    context.output.table(
      ['Connection', 'Driver', 'Target', 'Status', 'Latency'],
      results.map((r) => [
        r.connection,
        r.driver,
        r.target,
        r.status === 'healthy' ? colors.green('✓ HEALTHY') : colors.red('✖ UNHEALTHY'),
        `${r.latencyMs}ms`,
      ])
    );
    for (const r of results) {
      if (r.error) {
        context.output.text();
        context.output.error(`[${r.connection}] ${r.error}`);
      }
    }
    return healthy ? ExitCode.SUCCESS : ExitCode.DATABASE_ERROR;
  }
}
