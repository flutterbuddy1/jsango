import type {
  ArgumentDefinition,
  CommandDefinition,
  CommandExample,
  CommandHandler,
  ICommand,
  OptionDefinition,
} from './types.js';
import type { CommandContext } from './context.js';

export abstract class BaseCommand implements ICommand {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public readonly usage?: string | undefined;
  public readonly aliases?: readonly string[] | undefined;
  public readonly arguments?: readonly ArgumentDefinition[] | undefined;
  public readonly options?: readonly OptionDefinition[] | undefined;
  public readonly examples?: readonly CommandExample[] | undefined;
  public readonly hidden?: boolean | undefined;

  public abstract execute(context: CommandContext): Promise<number | void> | number | void;
}

export function defineCommand(
  definition: CommandDefinition & {
    execute: CommandHandler;
  }
): ICommand {
  return {
    ...definition,
    execute: definition.execute,
  };
}
