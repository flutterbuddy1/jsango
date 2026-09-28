import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class HealthCommand extends BaseCommand {
    readonly name = "health";
    readonly description = "Run application health checks";
    readonly usage = "jsango health [options]";
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=health.d.ts.map