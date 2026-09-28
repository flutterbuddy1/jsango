import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export declare class AiDoctorCommand extends BaseCommand {
    readonly name = "ai:doctor";
    readonly description = "Check AI providers, environment variables, and model connectivity";
    readonly usage = "jsango ai:doctor";
    readonly aliases: string[];
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=ai-doctor.d.ts.map