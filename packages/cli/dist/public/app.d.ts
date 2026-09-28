import { CommandRegistry } from './registry.js';
import type { ICommand } from './types.js';
import { CliOutput } from './output.js';
import type { ICommandProvider } from './provider.js';
export interface CliApplicationOptions {
    readonly registry?: CommandRegistry | undefined;
}
export declare class CliApplication {
    readonly registry: CommandRegistry;
    constructor(options?: CliApplicationOptions);
    static createDefault(): CliApplication;
    registerCommand(command: ICommand): this;
    registerProvider(provider: ICommandProvider): this;
    run(argv?: readonly string[], outputOverride?: CliOutput): Promise<number>;
}
//# sourceMappingURL=app.d.ts.map