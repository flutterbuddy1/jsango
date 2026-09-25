import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export const FRAMEWORK_VERSION = '1.0.0';

export class VersionCommand extends BaseCommand {
  public readonly name = 'version';
  public readonly description = 'Display the framework and CLI version';
  public readonly usage = 'django-js version';
  public readonly aliases = ['-v', '--version'];

  public execute(context: CommandContext): number {
    if (context.output.isJson) {
      context.output.json({
        framework: 'django-js',
        version: FRAMEWORK_VERSION,
        node: process.version,
        platform: process.platform,
      });
    } else {
      context.output.text(`django-js v${FRAMEWORK_VERSION} (node ${process.version})`);
    }
    return ExitCode.SUCCESS;
  }
}
