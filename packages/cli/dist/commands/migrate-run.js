import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { MigrationRunner } from '@jsango/migrations';
import { DestructiveOperationError } from '../public/errors.js';
export class MigrateRunCommand extends BaseCommand {
    name = 'migrate:run';
    description = 'Execute pending database migrations';
    usage = 'jsango migrate:run [options]';
    aliases = ['migrate'];
    options = [
        {
            name: 'connection',
            short: 'c',
            description: 'Database connection name',
            type: 'string',
            default: 'default',
        },
        {
            name: 'target',
            short: 't',
            description: 'Target migration ID to migrate up to',
            type: 'string',
        },
        {
            name: 'yes',
            short: 'y',
            description: 'Auto-confirm destructive migration operations',
            type: 'boolean',
        },
        {
            name: 'force',
            description: 'Force execution of destructive migration operations',
            type: 'boolean',
        },
    ];
    async execute(context) {
        const db = await context.getDatabaseManager();
        if (!db) {
            context.output.error('No database configured for this application.');
            return ExitCode.DATABASE_ERROR;
        }
        const connectionName = context.options['connection'] || 'default';
        const target = context.options['target'];
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
            context.output.success(`Applied ${result.applied.length} migration(s) in batch #${result.batch}:`);
            for (const id of result.applied) {
                context.output.text(`  ${colors.green('✓')} ${id}`);
            }
            return ExitCode.SUCCESS;
        }
        catch (err) {
            if (err instanceof Error && err.name === 'DestructiveMigrationError') {
                throw new DestructiveOperationError(err.message);
            }
            context.output.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
            return ExitCode.MIGRATION_ERROR;
        }
    }
}
//# sourceMappingURL=migrate-run.js.map