import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import type { CommandRegistry } from '../public/registry.js';
export declare class HelpCommand extends BaseCommand {
    readonly name = "help";
    readonly description = "Display help information for commands";
    readonly usage = "jsango help [command]";
    readonly aliases: string[];
    readonly arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
    private readonly registry;
    constructor(registry: CommandRegistry);
    execute(context: CommandContext): number;
    private renderCommandHelp;
    private renderGlobalHelp;
}
//# sourceMappingURL=help.d.ts.map