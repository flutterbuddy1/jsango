import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class CacheClearCommand extends BaseCommand {
    readonly name = "cache:clear";
    readonly description = "Clear all entries from the specified cache store (or default store)";
    readonly usage = "jsango cache:clear [options]";
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
        type: "boolean";
        default?: never;
    })[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=cache-clear.d.ts.map