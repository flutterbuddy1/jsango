import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { DriftDetector } from '@jsango/migrations';
export class MigrateCheckCommand extends BaseCommand {
    name = 'migrate:check';
    description = 'Detect schema drift between ORM models and database schema without modifying the database';
    usage = 'jsango migrate:check [options]';
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
        const connectionName = context.options['connection'] || 'default';
        const models = context.getModelRegistry().getAllModels();
        try {
            const conn = await db.connection(connectionName);
            let driftResult;
            try {
                const detector = new DriftDetector('memory');
                driftResult = await detector.detectDrift(conn, models.map((m) => m.metadata));
            }
            finally {
                if ('release' in conn && typeof conn.release === 'function') {
                    await conn.release();
                }
            }
            if (context.output.isJson) {
                context.output.json({
                    connection: connectionName,
                    hasDrift: driftResult.hasDrift,
                    differences: driftResult.differences,
                });
                return driftResult.hasDrift ? ExitCode.MIGRATION_ERROR : ExitCode.SUCCESS;
            }
            const { colors } = context.output;
            if (!driftResult.hasDrift) {
                context.output.success(`No schema drift detected on connection [${connectionName}]. Schema is synchronized.`);
                return ExitCode.SUCCESS;
            }
            context.output.error(`Schema drift detected! Found ${driftResult.differences.length} difference(s) on [${connectionName}]:`);
            for (const diff of driftResult.differences) {
                context.output.text(`  ${colors.red('✖')} ${diff}`);
            }
            context.output.text();
            context.output.text(`Run ${colors.cyan('jsango migrate:generate')} or ${colors.cyan('jsango migrate')} to synchronize.`);
            return ExitCode.MIGRATION_ERROR;
        }
        catch (err) {
            context.output.error(`Failed to check schema drift: ${err instanceof Error ? err.message : String(err)}`);
            return ExitCode.MIGRATION_ERROR;
        }
    }
}
//# sourceMappingURL=migrate-check.js.map