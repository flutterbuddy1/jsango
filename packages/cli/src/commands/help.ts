import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import type { CommandRegistry } from '../public/registry.js';
import type { ICommand } from '../public/types.js';
import { ExitCode } from '../public/types.js';
import { GLOBAL_OPTIONS } from '../public/parser.js';

export class HelpCommand extends BaseCommand {
  public readonly name = 'help';
  public readonly description = 'Display help information for commands';
  public readonly usage = 'django-js help [command]';
  public readonly aliases = ['-h', '--help'];
  public readonly arguments = [
    {
      name: 'command',
      description: 'The name of the command to show help for',
      required: false,
    },
  ];

  private readonly registry: CommandRegistry;

  public constructor(registry: CommandRegistry) {
    super();
    this.registry = registry;
  }

  public execute(context: CommandContext): number {
    const targetCommandName = context.args[0] as string | undefined;

    if (targetCommandName) {
      const command = this.registry.resolve(targetCommandName);
      if (!command) {
        context.output.error(`Command "${targetCommandName}" not found.`);
        return ExitCode.USAGE_ERROR;
      }
      this.renderCommandHelp(context, command);
      return ExitCode.SUCCESS;
    }

    this.renderGlobalHelp(context);
    return ExitCode.SUCCESS;
  }

  private renderCommandHelp(context: CommandContext, cmd: ICommand): void {
    if (context.output.isJson) {
      context.output.json({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage ?? `django-js ${cmd.name}`,
        aliases: cmd.aliases ?? [],
        arguments: cmd.arguments ?? [],
        options: [...(cmd.options ?? []), ...GLOBAL_OPTIONS],
        examples: cmd.examples ?? [],
      });
      return;
    }

    const { colors } = context.output;
    context.output.text(`${colors.bold('COMMAND')}: ${colors.cyan(cmd.name)}`);
    context.output.text(`  ${cmd.description}`);
    context.output.text();

    context.output.text(colors.bold('USAGE'));
    context.output.text(`  ${cmd.usage ?? `django-js ${cmd.name} [options]`}`);
    context.output.text();

    if (cmd.aliases && cmd.aliases.length > 0) {
      context.output.text(colors.bold('ALIASES'));
      context.output.text(`  ${cmd.aliases.join(', ')}`);
      context.output.text();
    }

    if (cmd.arguments && cmd.arguments.length > 0) {
      context.output.text(colors.bold('ARGUMENTS'));
      const rows = cmd.arguments.map((arg) => [
        `  ${arg.name}${arg.required ? '' : ' (optional)'}`,
        arg.description + (arg.default !== undefined ? ` [default: ${arg.default}]` : ''),
      ]);
      context.output.table(['Argument', 'Description'], rows);
      context.output.text();
    }

    const allOptions = [...(cmd.options ?? []), ...GLOBAL_OPTIONS];
    context.output.text(colors.bold('OPTIONS'));
    const optRows = allOptions.map((opt) => {
      const flags = [opt.short ? `-${opt.short},` : '   ', `--${opt.name}`].join(' ');
      const desc =
        opt.description +
        (opt.choices ? ` (choices: ${opt.choices.join(', ')})` : '') +
        (opt.default !== undefined ? ` [default: ${opt.default}]` : '');
      return [flags, desc];
    });
    context.output.table(['Option', 'Description'], optRows);
    context.output.text();

    if (cmd.examples && cmd.examples.length > 0) {
      context.output.text(colors.bold('EXAMPLES'));
      for (const ex of cmd.examples) {
        context.output.text(`  ${colors.dim('$')} ${ex.usage}`);
        if (ex.description) {
          context.output.text(`    ${colors.gray(ex.description)}`);
        }
      }
      context.output.text();
    }
  }

  private renderGlobalHelp(context: CommandContext): void {
    const commands = this.registry.list().filter((c) => !c.hidden);

    if (context.output.isJson) {
      context.output.json({
        framework: 'django-js',
        commands: commands.map((c) => ({
          name: c.name,
          description: c.description,
          usage: c.usage,
          aliases: c.aliases ?? [],
        })),
        globalOptions: GLOBAL_OPTIONS,
      });
      return;
    }

    const { colors } = context.output;
    context.output.text(
      `${colors.bold('django-js')} — Production-grade TypeScript backend framework`
    );
    context.output.text();
    context.output.text(colors.bold('USAGE'));
    context.output.text(`  ${colors.dim('$')} django-js <command> [options] [arguments]`);
    context.output.text();

    context.output.text(colors.bold('GLOBAL OPTIONS'));
    const optRows = GLOBAL_OPTIONS.map((opt) => [
      opt.short ? `-${opt.short}, --${opt.name}` : `    --${opt.name}`,
      opt.description,
    ]);
    context.output.table(['Option', 'Description'], optRows);
    context.output.text();

    // Group commands by namespace
    const groups = new Map<string, ICommand[]>();
    for (const cmd of commands) {
      const colonIdx = cmd.name.indexOf(':');
      const ns = colonIdx !== -1 ? cmd.name.slice(0, colonIdx) : 'general';
      if (!groups.has(ns)) {
        groups.set(ns, []);
      }
      groups.get(ns)!.push(cmd);
    }

    context.output.text(colors.bold('AVAILABLE COMMANDS'));
    for (const [ns, cmds] of groups.entries()) {
      context.output.text(`  ${colors.bold(ns.toUpperCase())}`);
      const rows = cmds.map((c) => [`    ${colors.cyan(c.name)}`, c.description]);
      context.output.table(['Command', 'Description'], rows);
      context.output.text();
    }

    context.output.text(
      `Run ${colors.cyan('django-js help <command>')} for details on a specific command.`
    );
  }
}
