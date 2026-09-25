import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MetricRegistry } from '@jsango/observability';

export class MetricsCommand extends BaseCommand {
  public readonly name = 'metrics';
  public readonly description = 'Display application metrics snapshot';
  public readonly usage = 'jsango metrics [options]';
  public readonly options = [
    {
      name: 'filter',
      short: 'f',
      description: 'Filter metrics by name substring',
      type: 'string' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const app = await context.getApplication();

    let registry: MetricRegistry;
    if (app && app.container && app.container.has('MetricRegistry')) {
      registry = app.container.resolve<MetricRegistry>('MetricRegistry');
    } else {
      registry = new MetricRegistry();
    }

    const filter = context.options['filter'] as string | undefined;
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

    const rows: string[][] = [];
    for (const m of snapshots) {
      for (const val of m.values) {
        const labelsStr =
          Object.keys(val.labels).length > 0 ? JSON.stringify(val.labels) : colors.dim('-');

        let valStr: string;
        if ('value' in val) {
          valStr = String(val.value);
        } else {
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
