import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MigrateRunCommand extends BaseCommand {
    readonly name = "migrate:run";
    readonly description = "Execute pending database migrations";
    readonly usage = "jsango migrate:run [options]";
    readonly aliases: string[];
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
        type: "string";
        default?: never;
    } | {
        name: string;
        short: string;
        description: string;
        type: "boolean";
        default?: never;
    } | {
        name: string;
        description: string;
        type: "boolean";
        short?: never;
        default?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=migrate-run.d.ts.map