import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class ModelShowCommand extends BaseCommand {
    readonly name = "model:show";
    readonly description = "Show detailed information about a specific ORM model";
    readonly usage = "jsango model:show <modelName>";
    readonly arguments: {
        name: string;
        description: string;
        required: boolean;
        type: "string";
    }[];
    execute(context: CommandContext): number;
}
//# sourceMappingURL=model-show.d.ts.map