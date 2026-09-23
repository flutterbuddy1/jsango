export interface CommandContext {
  readonly args: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean | undefined>>;
  readonly cwd: string;
}

export interface ICommand {
  readonly name: string;
  readonly description: string;
  execute(context: CommandContext): Promise<number | void>;
}
