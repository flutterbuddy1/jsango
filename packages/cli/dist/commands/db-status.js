import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
export class DbStatusCommand extends BaseCommand {
    name = 'db:status';
    description = 'Check database connection health and status';
    usage = 'jsango db:status [options]';
    aliases = ['database:status', 'db:health'];
    options = [
        {
            name: 'connection',
            short: 'c',
            description: 'Database connection name',
            type: 'string',
            default: 'default',
        },
    ];
    async execute(context) {
        const db = await context.getDatabaseManager();
        if (!db) {
            context.output.error('No database configured for this application.');
            return ExitCode.DATABASE_ERROR;
        }
        const connName = context.options['connection'] || 'default';
        try {
            const conn = await db.connection(connName);
            let isAlive = false;
            try {
                isAlive = await conn.ping();
            }
            finally {
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
            context.output.table(['Connection', 'Status', 'Ping'], [[connName, statusBadge, isAlive ? 'PONG' : 'NO RESPONSE']]);
            return isAlive ? ExitCode.SUCCESS : ExitCode.DATABASE_ERROR;
        }
        catch (err) {
            context.output.error(`Failed to connect to database [${connName}]: ${err instanceof Error ? err.message : String(err)}`);
            return ExitCode.DATABASE_ERROR;
        }
    }
}
//# sourceMappingURL=db-status.js.map