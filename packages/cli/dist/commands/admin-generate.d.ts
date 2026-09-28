import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class AdminGenerateCommand extends BaseCommand {
    readonly name = "make:admin";
    readonly description = "Generate a new typed AdminResource and model scaffold for JSango Admin";
    readonly usage = "jsango make:admin <ModelName> [options]";
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
        default: boolean;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=admin-generate.d.ts.map