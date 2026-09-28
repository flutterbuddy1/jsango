import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class QueueClearCommand extends BaseCommand {
    readonly name = "queue:clear";
    readonly description = "Delete all pending and scheduled jobs from the specified queue";
    readonly usage = "jsango queue:clear [options]";
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    } | {
        name: string;
        short: string;
        description: string;
        type: "boolean";
        default?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=queue-clear.d.ts.map