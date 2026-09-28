import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
export const FRAMEWORK_VERSION = '1.0.0';
export class VersionCommand extends BaseCommand {
    name = 'version';
    description = 'Display the framework and CLI version';
    usage = 'jsango version';
    aliases = ['-v', '--version'];
    execute(context) {
        if (context.output.isJson) {
            context.output.json({
                framework: 'jsango',
                version: FRAMEWORK_VERSION,
                node: process.version,
                platform: process.platform,
            });
        }
        else {
            context.output.text(`jsango v${FRAMEWORK_VERSION} (node ${process.version})`);
        }
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=version.js.map