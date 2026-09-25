import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError } from '../public/errors.js';
import { CacheManager } from '@django-js/cache';

export class CacheClearCommand extends BaseCommand {
  public readonly name = 'cache:clear';
  public readonly description =
    'Clear all entries from the specified cache store (or default store)';
  public readonly usage = 'django-js cache:clear [options]';
  public readonly options = [
    {
      name: 'store',
      short: 's',
      description: 'Named cache store to clear',
      type: 'string' as const,
      default: 'default',
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force clearing without interactive confirmation',
      type: 'boolean' as const,
    },
    {
      name: 'yes',
      short: 'y',
      description: 'Auto-confirm clearing destructive action',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const isForce = Boolean(context.options['force'] || context.options['yes']);
    if (!isForce) {
      throw new DestructiveOperationError(
        'Clearing the cache will remove all stored entries. Pass --force to confirm this operation.'
      );
    }

    const storeName = (context.options['store'] as string) || 'default';
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
