import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { HealthRegistry } from '@jsango/observability';
export class HealthCommand extends BaseCommand {
    name = 'health';
    description = 'Run application health checks';
    usage = 'jsango health [options]';
    async execute(context) {
        const app = await context.getApplication();
        let registry;
        if (app && app.container && app.container.has('HealthRegistry')) {
            registry = app.container.resolve('HealthRegistry');
        }
        else {
            registry = new HealthRegistry();
            registry.register('process', () => true);
        }
        const report = await registry.checkAll();
        if (context.output.isJson) {
            context.output.json(report);
            return report.status === 'unhealthy' ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS;
        }
        const { colors } = context.output;
        const statusColor = report.status === 'healthy'
            ? colors.green(report.status.toUpperCase())
            : report.status === 'degraded'
                ? colors.yellow(report.status.toUpperCase())
                : colors.red(report.status.toUpperCase());
        context.output.text(colors.bold(`Application Health Status: `) + statusColor);
        context.output.text(colors.dim(`Duration: ${report.durationMs.toFixed(2)}ms | Timestamp: ${report.timestamp}`));
        context.output.text();
        const rows = Object.entries(report.checks).map(([name, checkResult]) => {
            const checkStatus = checkResult.status === 'healthy'
                ? colors.green(checkResult.status)
                : checkResult.status === 'degraded'
                    ? colors.yellow(checkResult.status)
                    : colors.red(checkResult.status);
            return [
                colors.cyan(name),
                checkStatus,
                `${checkResult.durationMs.toFixed(2)}ms`,
                checkResult.error ?? colors.dim('-'),
            ];
        });
        context.output.table(['Check', 'Status', 'Duration', 'Error'], rows);
        return report.status === 'unhealthy' ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=health.js.map