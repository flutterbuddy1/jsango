import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class DbStatusCommand extends BaseCommand {
  public readonly name = 'db:status';
  public readonly description = 'Check database connection health and status';
  public readonly usage = 'jsango db:status [options]';
  public readonly aliases = ['database:status', 'db:health'];
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

    const connName = (context.options['connection'] as string) || 'default';

    try {
      const conn = await db.connection(connName);
      let isAlive = false;
      try {
        isAlive = await conn.ping();
      } finally {
        if ('release' in conn && typeof conn.release === 'function') {
          await conn.release();
        }
      }

      const statusData = {
        connection: connName,
        status: isAlive ? 'healthy' : 'unhealthy',
        responsive: isAlive,
      };

      if (context.output.isJson) {
        context.output.json(statusData);
        return isAlive ? ExitCode.SUCCESS : ExitCode.DATABASE_ERROR;
      }

      const { colors } = context.output;
      context.output.text(colors.bold(`Database Health: [${connName}]`));
      context.output.text();

      const statusBadge = isAlive ? colors.green('✓ HEALTHY') : colors.red('✖ UNHEALTHY');
      context.output.table(
        ['Connection', 'Status', 'Ping'],
        [[connName, statusBadge, isAlive ? 'PONG' : 'NO RESPONSE']]
      );

      return isAlive ? ExitCode.SUCCESS : ExitCode.DATABASE_ERROR;
    } catch (err) {
      context.output.error(
        `Failed to connect to database [${connName}]: ${err instanceof Error ? err.message : String(err)}`
      );
      return ExitCode.DATABASE_ERROR;
    }
  }
}
