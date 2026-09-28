import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { MetricRegistry } from '@jsango/observability';
export class MetricsCommand extends BaseCommand {
    name = 'metrics';
    description = 'Display application metrics snapshot';
    usage = 'jsango metrics [options]';
    options = [
        {
            name: 'filter',
            short: 'f',
            description: 'Filter metrics by name substring',
            type: 'string',
        },
    ];
    async execute(context) {
        const app = await context.getApplication();
        let registry;
        if (app && app.container && app.container.has('MetricRegistry')) {
            registry = app.container.resolve('MetricRegistry');
        }
        else {
            registry = new MetricRegistry();
        }
        const filter = context.options['filter'];
        let snapshots = registry.snapshot();
        if (filter) {
            snapshots = snapshots.filter((m) => m.name.includes(filter));
        }
        if (context.output.isJson) {
            context.output.json({
                total: snapshots.length,
                timestamp: new Date().toISOString(),
                metrics: snapshots,
            });
            return ExitCode.SUCCESS;
        }
        if (snapshots.length === 0) {
            context.output.text('No metrics found.');
            return ExitCode.SUCCESS;
        }
        const { colors } = context.output;
        context.output.text(colors.bold(`Application Metrics (${snapshots.length})`));
        context.output.text();
        const rows = [];
        for (const m of snapshots) {
            for (const val of m.values) {
                const labelsStr = Object.keys(val.labels).length > 0 ? JSON.stringify(val.labels) : colors.dim('-');
                let valStr;
                if ('value' in val) {
                    valStr = String(val.value);
                }
                else {
                    const minStr = val.min !== undefined ? val.min.toFixed(2) : '-';
                    const maxStr = val.max !== undefined ? val.max.toFixed(2) : '-';
                    valStr = `count: ${val.count}, sum: ${val.sum.toFixed(2)}, min: ${minStr}, max: ${maxStr}`;
                }
                rows.push([
                    colors.cyan(m.name),
                    colors.yellow(m.type),
                    valStr,
                    labelsStr,
                    colors.dim(m.description),
                ]);
            }
        }
        context.output.table(['Name', 'Type', 'Value', 'Labels', 'Description'], rows);
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=metrics.js.map