import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { MaskUtil } from '../internal/mask.js';

export class ConfigShowCommand extends BaseCommand {
  public readonly name = 'config:show';
  public readonly description = 'Display loaded application configuration (secrets masked)';
  public readonly usage = 'jsango config:show [options]';

  public execute(context: CommandContext): number {
    const config = context.getConfig();
    const rawData = (config as unknown as { values?: Record<string, unknown> }).values ?? {
      env: context.env,
      projectRoot: context.projectRoot,
    };

    // Mask all sensitive values
    const masked = MaskUtil.maskValue(rawData) as Record<string, unknown>;

    if (context.output.isJson) {
      context.output.json(masked);
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold('Application Configuration (Masked)'));
    context.output.text();

    const rows = Object.entries(masked).map(([key, val]) => {
      const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
      const isMasked = valStr.includes('********');
      return [colors.cyan(key), isMasked ? colors.yellow(valStr) : valStr];
    });

    context.output.table(['Key', 'Value'], rows);
    return ExitCode.SUCCESS;
  }
}
