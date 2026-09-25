import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export const FRAMEWORK_VERSION = '1.0.0';

export class VersionCommand extends BaseCommand {
  public readonly name = 'version';
  public readonly description = 'Display the framework and CLI version';
  public readonly usage = 'jsango version';
  public readonly aliases = ['-v', '--version'];

  public execute(context: CommandContext): number {
    if (context.output.isJson) {
      context.output.json({
        framework: 'jsango',
        version: FRAMEWORK_VERSION,
        node: process.version,
        platform: process.platform,
      });
    } else {
      context.output.text(`jsango v${FRAMEWORK_VERSION} (node ${process.version})`);
    }
    return ExitCode.SUCCESS;
  }
}
