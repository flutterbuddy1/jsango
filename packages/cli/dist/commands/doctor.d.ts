import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
export interface DiagnosticCheck {
    readonly category: string;
    readonly name: string;
    readonly status: 'ok' | 'warn' | 'error';
    readonly message: string;
    readonly details?: unknown;
}
export declare class DoctorCommand extends BaseCommand {
    readonly name = "doctor";
    readonly description = "Run system and project diagnostics";
    readonly usage = "jsango doctor [options]";
    execute(context: CommandContext): Promise<number>;
}
//# sourceMappingURL=doctor.d.ts.map