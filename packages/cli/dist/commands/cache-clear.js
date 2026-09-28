import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError } from '../public/errors.js';
import { CacheManager } from '@jsango/cache';
export class CacheClearCommand extends BaseCommand {
    name = 'cache:clear';
    description = 'Clear all entries from the specified cache store (or default store)';
    usage = 'jsango cache:clear [options]';
    options = [
        {
            name: 'store',
            short: 's',
            description: 'Named cache store to clear',
            type: 'string',
            default: 'default',
        },
        {
            name: 'force',
            short: 'f',
            description: 'Force clearing without interactive confirmation',
            type: 'boolean',
        },
        {
            name: 'yes',
            short: 'y',
            description: 'Auto-confirm clearing destructive action',
            type: 'boolean',
        },
    ];
    async execute(context) {
        const isForce = Boolean(context.options['force'] || context.options['yes']);
        if (!isForce) {
            throw new DestructiveOperationError('Clearing the cache will remove all stored entries. Pass --force to confirm this operation.');
        }
        const storeName = context.options['store'] || 'default';
        let cacheManager = await context.getCacheManager();
        if (!cacheManager) {
            cacheManager = new CacheManager({ default: storeName });
            context.setCacheManager(cacheManager);
        }
        const store = cacheManager.store(storeName);
        await store.clear();
        if (context.output.isJson) {
            context.output.json({
                cleared: true,
                store: storeName,
                timestamp: Date.now(),
            });
            return ExitCode.SUCCESS;
        }
        const { colors } = context.output;
        context.output.success(`Cache store ${colors.cyan(`"${storeName}"`)} cleared successfully.`);
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=cache-clear.js.map