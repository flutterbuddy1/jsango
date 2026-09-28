import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class QueueStatusCommand extends BaseCommand {
    readonly name = "queue:status";
    readonly description = "Show status and metrics for background job queues";
    readonly usage = "jsango queue:status [options]";
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=queue-status.d.ts.map