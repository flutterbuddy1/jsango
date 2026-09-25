import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class EventsListCommand extends BaseCommand {
  public readonly name = 'events:list';
  public readonly description = 'List all registered events and their handlers';
  public readonly usage = 'django-js events:list [options]';
  public readonly options = [];

  public async execute(context: CommandContext): Promise<number> {
    const eventBus = await context.getEventBus();

    if (!eventBus) {
      if (context.output.isJson) {
        context.output.json({ events: [] });
      } else {
        context.output.info('No EventBus instance found in application container.');
      }
      return ExitCode.SUCCESS;
    }

    const inspection = eventBus.registry.inspect();

    if (context.output.isJson) {
      context.output.json({ events: inspection });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold('Registered Events & Handlers\n'));

    if (inspection.length === 0) {
      context.output.info('No events currently registered.');
      return ExitCode.SUCCESS;
    }

    const rows = inspection.map((e) => [
      colors.cyan(e.type),
      String(e.handlerCount),
      e.handlers.map((h) => `${h.id} (${h.mode}, p:${h.priority})`).join(', '),
    ]);

    context.output.table(['Event Type', 'Handlers', 'Handler Details'], rows);
    return ExitCode.SUCCESS;
  }
}
