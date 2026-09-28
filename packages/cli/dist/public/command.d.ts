import type { ArgumentDefinition, CommandDefinition, CommandExample, CommandHandler, ICommand, OptionDefinition } from './types.js';
import type { CommandContext } from './context.js';
export declare abstract class BaseCommand implements ICommand {
    abstract readonly name: string;
    abstract readonly description: string;
    readonly usage?: string | undefined;
    readonly aliases?: readonly string[] | undefined;
    readonly arguments?: readonly ArgumentDefinition[] | undefined;
    readonly options?: readonly OptionDefinition[] | undefined;
    readonly examples?: readonly CommandExample[] | undefined;
    readonly hidden?: boolean | undefined;
    abstract execute(context: CommandContext): Promise<number | void> | number | void;
}
export declare function defineCommand(definition: CommandDefinition & {
    execute: CommandHandler;
}): ICommand;
//# sourceMappingURL=command.d.ts.map