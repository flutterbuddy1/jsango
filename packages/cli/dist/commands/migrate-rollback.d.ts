import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MigrateRollbackCommand extends BaseCommand {
    readonly name = "migrate:rollback";
    readonly description = "Rollback applied database migrations";
    readonly usage = "jsango migrate:rollback [options]";
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
        default?: never;
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
//# sourceMappingURL=migrate-rollback.d.ts.map