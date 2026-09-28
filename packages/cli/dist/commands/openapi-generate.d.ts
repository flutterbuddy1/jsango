import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class OpenApiGenerateCommand extends BaseCommand {
    readonly name = "openapi:generate";
    readonly description = "Generate OpenAPI 3.x specification document for the application";
    readonly usage = "jsango openapi:generate [options]";
    readonly aliases: string[];
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "string";
        default?: never;
    } | {
        name: string;
        short: string;
        description: string;
        type: "string";
        default: string;
    } | {
        name: string;
        description: string;
        type: "string";
        short?: never;
        default?: never;
    } | {
        name: string;
        description: string;
        type: "boolean";
        default: boolean;
        short?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=openapi-generate.d.ts.map