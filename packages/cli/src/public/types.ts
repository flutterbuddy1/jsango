import type { CommandContext } from './context.js';

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  USAGE_ERROR = 2,
  CONFIG_ERROR = 3,
  DATABASE_ERROR = 4,
  MIGRATION_ERROR = 5,
  INTERRUPTED = 130,
}

export type OutputMode = 'text' | 'json' | 'quiet';

export type OptionType = 'string' | 'number' | 'boolean' | 'enum' | 'array';

export interface ArgumentDefinition {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean | undefined;
  readonly default?: unknown;
  readonly type?: 'string' | 'number' | 'boolean' | undefined;
  readonly variadic?: boolean | undefined;
}

export interface OptionDefinition {
  readonly name: string;
  readonly short?: string | undefined;
  readonly description: string;
  readonly type?: OptionType | undefined;
  readonly required?: boolean | undefined;
  readonly default?: unknown;
  readonly choices?: readonly string[] | undefined;
}

export interface CommandExample {
  readonly usage: string;
  readonly description?: string | undefined;
}

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly arguments?: readonly ArgumentDefinition[] | undefined;
  readonly options?: readonly OptionDefinition[] | undefined;
  readonly examples?: readonly CommandExample[] | undefined;
  readonly hidden?: boolean | undefined;
}

export type CommandHandler = (context: CommandContext) => Promise<number | void> | number | void;

export interface ICommand extends CommandDefinition {
  execute(context: CommandContext): Promise<number | void> | number | void;
}

export interface ParsedArgs {
  readonly commandName?: string | undefined;
  readonly args: readonly (string | number | boolean)[];
  readonly options: Readonly<Record<string, unknown>>;
  readonly raw: readonly string[];
}
