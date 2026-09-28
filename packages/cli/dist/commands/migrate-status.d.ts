import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MigrateStatusCommand extends BaseCommand {
    readonly name = "migrate:status";
    readonly description = "Show current migration status and pending migrations";
    readonly usage = "jsango migrate:status [options]";
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=migrate-status.d.ts.map