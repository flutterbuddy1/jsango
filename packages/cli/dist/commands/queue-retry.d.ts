import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class QueueRetryCommand extends BaseCommand {
    readonly name = "queue:retry";
    readonly description = "Retry one or all failed jobs from the dead-letter store";
    readonly usage = "jsango queue:retry [id] [options]";
    readonly arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "boolean";
    } | {
        name: string;
        short: string;
        description: string;
        type: "string";
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=queue-retry.d.ts.map