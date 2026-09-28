import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MigrateCheckCommand extends BaseCommand {
    readonly name = "migrate:check";
    readonly description = "Detect schema drift between ORM models and database schema without modifying the database";
    readonly usage = "jsango migrate:check [options]";
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=migrate-check.d.ts.map