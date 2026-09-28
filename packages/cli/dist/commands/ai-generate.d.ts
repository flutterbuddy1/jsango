import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class AiGenerateCommand extends BaseCommand {
    readonly name = "make:agent";
    readonly description = "Generate a new typed AI Agent and Tool definition for JSango";
    readonly usage = "jsango make:agent <AgentName> [options]";
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
//# sourceMappingURL=ai-generate.d.ts.map