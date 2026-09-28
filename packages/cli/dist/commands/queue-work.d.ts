import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class QueueWorkCommand extends BaseCommand {
    readonly name = "queue:work";
    readonly description = "Start processing jobs on the specified queue as a worker";
    readonly usage = "jsango queue:work [options]";
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
        type: "number";
        default: number;
    } | {
        name: string;
        description: string;
        type: "number";
        default: number;
        short?: never;
    } | {
        name: string;
        description: string;
        type: "boolean";
        short?: never;
        default?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=queue-work.d.ts.map