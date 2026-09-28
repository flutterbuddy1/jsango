import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class WsStatusCommand extends BaseCommand {
    readonly name = "ws:status";
    readonly description = "Show WebSocket server connection metrics and room statistics";
    readonly usage = "jsango ws:status [options]";
    readonly options: never[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=ws-status.d.ts.map