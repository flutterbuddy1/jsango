import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class QueueFailedCommand extends BaseCommand {
    readonly name = "queue:failed";
    readonly description = "List all failed jobs recorded in the dead-letter store";
    readonly usage = "jsango queue:failed [options]";
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "string";
        default?: never;
    } | {
        name: string;
        short: string;
        description: string;
        type: "number";
        default: number;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=queue-failed.d.ts.map