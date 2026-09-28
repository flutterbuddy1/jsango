import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class DbStatusCommand extends BaseCommand {
    readonly name = "db:status";
    readonly description = "Check database connection health and status";
    readonly usage = "jsango db:status [options]";
    readonly aliases: string[];
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=db-status.d.ts.map