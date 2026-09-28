import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class RouteListCommand extends BaseCommand {
    readonly name = "route:list";
    readonly description = "List all registered HTTP routes";
    readonly usage = "jsango route:list [options]";
    readonly aliases: string[];
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "string";
    } | {
        name: string;
        description: string;
        type: "string";
        short?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=route-list.d.ts.map