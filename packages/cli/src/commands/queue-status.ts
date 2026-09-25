import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { QueueManager } from '@django-js/queue';

export class QueueStatusCommand extends BaseCommand {
  public readonly name = 'queue:status';
  public readonly description = 'Show status and metrics for background job queues';
  public readonly usage = 'django-js queue:status [options]';
  public readonly options = [
    {
      name: 'queue',
      short: 'q',
      description: 'Named queue to inspect (comma-separated for multiple)',
      type: 'string' as const,
      default: 'default',
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const queueRaw = (context.options['queue'] as string) || 'default';
    const queues = queueRaw
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);

    let queueManager = await context.getQueueManager();
    if (!queueManager) {
      queueManager = new QueueManager();
      context.setQueueManager(queueManager);
    }

    const allStats = [];
    for (const q of queues) {
      const queue = queueManager.queue(q);
      const stats = await queue.stats();
      allStats.push(stats);
    }

    if (context.output.isJson) {
      context.output.json(allStats);
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold('Queue Status Summary'));
    context.output.text();

    const rows = allStats.map((s) => [
      colors.cyan(s.queueName),
      String(s.pendingCount),
      String(s.scheduledCount),
      String(s.processingCount),
      String(s.completedCount),
      s.failedCount > 0 ? colors.red(String(s.failedCount)) : String(s.failedCount),
    ]);

    context.output.table(
      ['Queue', 'Pending', 'Scheduled', 'Processing', 'Completed', 'Failed'],
      rows
    );

    return ExitCode.SUCCESS;
  }
}
