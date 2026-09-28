import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class ModelListCommand extends BaseCommand {
    readonly name = "model:list";
    readonly description = "List all registered ORM models";
    readonly usage = "jsango model:list [options]";
    readonly aliases: string[];
    execute(context: CommandContext): number;
}
//# sourceMappingURL=model-list.d.ts.map