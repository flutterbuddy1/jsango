import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError } from '../public/errors.js';
import { QueueManager } from '@django-js/queue';

export class QueueClearCommand extends BaseCommand {
  public readonly name = 'queue:clear';
  public readonly description = 'Delete all pending and scheduled jobs from the specified queue';
  public readonly usage = 'django-js queue:clear [options]';
  public readonly options = [
    {
      name: 'queue',
      short: 'q',
      description: 'The name of the queue to clear',
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
      description: 'Auto-confirm destructive operation',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const isForce = Boolean(context.options['force'] || context.options['yes']);
    if (!isForce) {
      throw new DestructiveOperationError(
        'Clearing the queue will permanently remove all queued jobs. Pass --force to confirm this operation.'
      );
    }

    const queueName = (context.options['queue'] as string) || 'default';
    let queueManager = await context.getQueueManager();
    if (!queueManager) {
      queueManager = new QueueManager();
      context.setQueueManager(queueManager);
    }

    const queue = queueManager.queue(queueName);
    await queue.clear();

    if (context.output.isJson) {
      context.output.json({ cleared: true, queue: queueName });
    } else {
      const { colors } = context.output;
      context.output.success(`Queue ${colors.cyan(`"${queueName}"`)} cleared successfully.`);
    }

    return ExitCode.SUCCESS;
  }
}
