import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class ConfigShowCommand extends BaseCommand {
    readonly name = "config:show";
    readonly description = "Display loaded application configuration (secrets masked)";
    readonly usage = "jsango config:show [options]";
    execute(context: CommandContext): number;
}
//# sourceMappingURL=config-show.d.ts.map