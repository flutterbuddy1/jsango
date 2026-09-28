import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class DiagnosticsCommand extends BaseCommand {
    readonly name = "diagnostics";
    readonly description = "Display safe runtime and subsystem diagnostics";
    readonly usage = "jsango diagnostics [options]";
    readonly aliases: string[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=diagnostics.d.ts.map