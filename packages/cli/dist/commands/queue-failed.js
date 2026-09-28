import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { QueueManager } from '@jsango/queue';
export class QueueFailedCommand extends BaseCommand {
    name = 'queue:failed';
    description = 'List all failed jobs recorded in the dead-letter store';
    usage = 'jsango queue:failed [options]';
    options = [
        {
            name: 'queue',
            short: 'q',
            description: 'Filter failed jobs by queue name',
            type: 'string',
        },
        {
            name: 'limit',
            short: 'l',
            description: 'Maximum number of failed jobs to list',
            type: 'number',
            default: 50,
        },
    ];
    async execute(context) {
        const queue = context.options['queue'];
        const limit = Number(context.options['limit']) || 50;
        let queueManager = await context.getQueueManager();
        if (!queueManager) {
            queueManager = new QueueManager();
            context.setQueueManager(queueManager);
        }
        const failedStore = queueManager.failedJobStore;
        const failedJobs = await failedStore.list({ queue, limit });
        if (context.output.isJson) {
            context.output.json(failedJobs);
            return ExitCode.SUCCESS;
        }
        const { colors } = context.output;
        context.output.text(colors.bold('Failed Jobs'));
        context.output.text();
        if (failedJobs.length === 0) {
            context.output.info('No failed jobs found.');
            return ExitCode.SUCCESS;
        }
        const rows = failedJobs.map((j) => [
            colors.yellow(j.id.slice(0, 8)),
            colors.cyan(j.jobType),
            j.queue,
            String(j.attempts),
            j.error.message.slice(0, 40),
            new Date(j.failedAt).toISOString(),
        ]);
        context.output.table(['ID', 'Type', 'Queue', 'Attempts', 'Error', 'Failed At'], rows);
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=queue-failed.js.map