import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class OpenApiValidateCommand extends BaseCommand {
    readonly name = "openapi:validate";
    readonly description = "Validate an OpenAPI document for schema compliance and reference integrity";
    readonly usage = "jsango openapi:validate [options]";
    readonly options: ({
        name: string;
        short: string;
        description: string;
        type: "string";
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
//# sourceMappingURL=openapi-validate.d.ts.map