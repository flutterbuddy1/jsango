import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class MetricsCommand extends BaseCommand {
    readonly name = "metrics";
    readonly description = "Display application metrics snapshot";
    readonly usage = "jsango metrics [options]";
    readonly options: {
        name: string;
        short: string;
        description: string;
        type: "string";
    }[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=metrics.d.ts.map