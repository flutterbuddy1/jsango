import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { QueueManager } from '@jsango/queue';

export class QueueWorkCommand extends BaseCommand {
  public readonly name = 'queue:work';
  public readonly description = 'Start processing jobs on the specified queue as a worker';
  public readonly usage = 'jsango queue:work [options]';
  public readonly options = [
    {
      name: 'queue',
      short: 'q',
      description: 'The names of the queues to work, comma-separated',
      type: 'string' as const,
      default: 'default',
    },
    {
      name: 'concurrency',
      short: 'c',
      description: 'Maximum number of concurrent jobs',
      type: 'number' as const,
      default: 5,
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Maximum job execution time in milliseconds',
      type: 'number' as const,
      default: 30000,
    },
    {
      name: 'tries',
      description: 'Number of times to attempt a job before failing',
      type: 'number' as const,
      default: 3,
    },
    {
      name: 'sleep',
      short: 's',
      description: 'Polling interval in milliseconds when checking for jobs',
      type: 'number' as const,
      default: 100,
    },
    {
      name: 'once',
      description: 'Only process next batch of available jobs and exit',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const queueRaw = (context.options['queue'] as string) || 'default';
    const queues = queueRaw
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
    const concurrency = Number(context.options['concurrency']) || 5;
    const pollingIntervalMs = Number(context.options['sleep']) || 100;
    const isOnce = Boolean(context.options['once']);

    let queueManager = await context.getQueueManager();
    if (!queueManager) {
      queueManager = new QueueManager();
      context.setQueueManager(queueManager);
    }

    const worker = queueManager.createWorker({
      queues,
      concurrency,
      pollingIntervalMs,
      logger: context.logger,
    });

    if (isOnce) {
      const processed = await worker.runOnce();
      if (context.output.isJson) {
        context.output.json({ processed, queues });
      } else {
        context.output.success(
          `Processed ${processed} job(s) across queues: ${queues.join(', ')}.`
        );
      }
      return ExitCode.SUCCESS;
    }

    if (!context.output.isJson) {
      const { colors } = context.output;
      context.output.info(
        `Starting worker on queue(s): ${colors.cyan(queues.join(', '))} (concurrency: ${concurrency})...`
      );
      context.output.text('Press Ctrl+C to stop worker gracefully.');
    }

    worker.start();

    // Await cancellation signal
    if (context.signal) {
      await new Promise<void>((resolve) => {
        if (context.signal?.aborted) {
          resolve();
        } else {
          context.signal?.addEventListener('abort', () => resolve(), { once: true });
        }
      });
    }

    await worker.stop();
    return ExitCode.SUCCESS;
  }
}
