import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { QueueManager } from '@jsango/queue';
export class QueueStatusCommand extends BaseCommand {
    name = 'queue:status';
    description = 'Show status and metrics for background job queues';
    usage = 'jsango queue:status [options]';
    options = [
        {
            name: 'queue',
            short: 'q',
            description: 'Named queue to inspect (comma-separated for multiple)',
            type: 'string',
            default: 'default',
        },
    ];
    async execute(context) {
        const queueRaw = context.options['queue'] || 'default';
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
        context.output.table(['Queue', 'Pending', 'Scheduled', 'Processing', 'Completed', 'Failed'], rows);
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=queue-status.js.map