import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DiagnosticsProvider, type DiagnosticInfo } from '@django-js/observability';

export class DiagnosticsCommand extends BaseCommand {
  public readonly name = 'diagnostics';
  public readonly description = 'Display safe runtime and subsystem diagnostics';
  public readonly usage = 'django-js diagnostics [options]';
  public readonly aliases = ['diag'];

  public async execute(context: CommandContext): Promise<number> {
    const app = await context.getApplication();
    const provider = new DiagnosticsProvider();

    if (app && app.container && app.container.has('HealthRegistry')) {
      const health = app.container.resolve<{ checkAll?: () => Promise<unknown> }>('HealthRegistry');
      if (typeof health.checkAll === 'function') {
        provider.registerComponent('health', async () => ({
          status: 'ready',
          details: (await health.checkAll!()) as Record<string, unknown>,
        }));
      }
    }

    const report: DiagnosticInfo = await provider.getDiagnostics();

    if (context.output.isJson) {
      context.output.json(report);
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold('Runtime & Subsystem Diagnostics'));
    context.output.text(
      colors.dim(`Timestamp: ${report.timestamp} | Uptime: ${report.uptimeSeconds}s`)
    );
    context.output.text();

    context.output.text(colors.bold('Runtime Info:'));
    context.output.text(
      `  Runtime: ${report.runtime.name} ${report.runtime.version} (${report.runtime.platform})`
    );
    context.output.text(
      `  Memory RSS: ${report.memory.rssMb} MB | Heap Used: ${report.memory.heapUsedMb} MB / ${report.memory.heapTotalMb} MB`
    );
    context.output.text();

    const components = Object.entries(report.components);
    if (components.length > 0) {
      context.output.text(colors.bold('Components:'));
      for (const [name, comp] of components) {
        const statusColor =
          comp.status === 'error'
            ? colors.red(comp.status)
            : comp.status === 'ready' || comp.status === 'active'
              ? colors.green(comp.status)
              : colors.yellow(comp.status);
        context.output.text(`  ${colors.cyan(name)}: [${statusColor}]`);
      }
    }

    return ExitCode.SUCCESS;
  }
}
