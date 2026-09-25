import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { UsageError } from '../public/errors.js';
import { QueueManager } from '@jsango/queue';

export class QueueRetryCommand extends BaseCommand {
  public readonly name = 'queue:retry';
  public readonly description = 'Retry one or all failed jobs from the dead-letter store';
  public readonly usage = 'jsango queue:retry [id] [options]';
  public readonly arguments = [
    {
      name: 'id',
      description: 'The ID of the failed job to retry',
      required: false,
    },
  ];
  public readonly options = [
    {
      name: 'all',
      short: 'a',
      description: 'Retry all failed jobs',
      type: 'boolean' as const,
    },
    {
      name: 'queue',
      short: 'q',
      description: 'Filter retried jobs by queue when using --all',
      type: 'string' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const isAll = Boolean(context.options['all']);
    const targetId = context.args[0] ? String(context.args[0]) : undefined;

    if (!isAll && !targetId) {
      throw new UsageError('Must provide either a failed job ID or the --all flag.');
    }

    let queueManager = await context.getQueueManager();
    if (!queueManager) {
      queueManager = new QueueManager();
      context.setQueueManager(queueManager);
    }

    const failedStore = queueManager.failedJobStore;
    let retriedCount = 0;

    if (targetId) {
      const job = await failedStore.get(targetId);
      if (!job) {
        context.output.error(`Failed job with ID "${targetId}" not found.`);
        return ExitCode.GENERAL_ERROR;
      }

      const q = queueManager.queue(job.queue);
      await q.dispatch(job.jobType, job.payload);
      await failedStore.delete(targetId);
      retriedCount = 1;
    } else {
      const queueFilter = context.options['queue'] as string | undefined;
      const allFailed = await failedStore.list({ queue: queueFilter, limit: 1000 });

      for (const job of allFailed) {
        const q = queueManager.queue(job.queue);
        await q.dispatch(job.jobType, job.payload);
        await failedStore.delete(job.id);
        retriedCount++;
      }
    }

    if (context.output.isJson) {
      context.output.json({ retried: retriedCount });
    } else {
      context.output.success(`Successfully requeued ${retriedCount} failed job(s).`);
    }

    return ExitCode.SUCCESS;
  }
}
