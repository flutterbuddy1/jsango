import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare const FRAMEWORK_VERSION = "1.0.0";
export declare class VersionCommand extends BaseCommand {
    readonly name = "version";
    readonly description = "Display the framework and CLI version";
    readonly usage = "jsango version";
    readonly aliases: string[];
    execute(context: CommandContext): number;
}
//# sourceMappingURL=version.d.ts.map