import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class EventsListCommand extends BaseCommand {
    readonly name = "events:list";
    readonly description = "List all registered events and their handlers";
    readonly usage = "jsango events:list [options]";
    readonly options: never[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=events-list.d.ts.map