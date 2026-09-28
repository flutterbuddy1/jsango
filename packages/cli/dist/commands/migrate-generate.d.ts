import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MigrateGenerateCommand extends BaseCommand {
    readonly name = "migrate:generate";
    readonly description = "Generate a new migration from ORM model schema diff";
    readonly usage = "jsango migrate:generate <name> [options]";
    readonly arguments: {
        name: string;
        description: string;
        required: boolean;
        type: "string";
    }[];
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=migrate-generate.d.ts.map