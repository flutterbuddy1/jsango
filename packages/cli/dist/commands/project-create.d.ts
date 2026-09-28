import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class ProjectCreateCommand extends BaseCommand {
    readonly name = "create";
    readonly description = "Create and scaffold a new jsango project";
    readonly usage = "jsango create <projectName> [options]";
    readonly aliases: string[];
    readonly arguments: {
        name: string;
        description: string;
        required: boolean;
        type: "string";
    }[];
    readonly options: {
        name: string;
        description: string;
        type: "boolean";
    }[];
    execute(context: CommandContext): number;
}
//# sourceMappingURL=project-create.d.ts.map