import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class ModelListCommand extends BaseCommand {
  public readonly name = 'model:list';
  public readonly description = 'List all registered ORM models';
  public readonly usage = 'django-js model:list [options]';
  public readonly aliases = ['models'];

  public execute(context: CommandContext): number {
    const registry = context.getModelRegistry();
    const models = registry.getAllModels();

    if (context.output.isJson) {
      context.output.json({
        total: models.length,
        models: models.map((m) => m.metadata.toJSON()),
      });
      return ExitCode.SUCCESS;
    }

    if (models.length === 0) {
      context.output.text('No registered ORM models found.');
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold(`Registered ORM Models (${models.length})`));
    context.output.text();

    const rows = models.map((m) => {
      const meta = m.metadata;
      return [
        colors.cyan(meta.name),
        meta.table,
        meta.primaryKey,
        meta.connection,
        String(meta.fields.size),
        String(meta.relations.size),
      ];
    });

    context.output.table(
      ['Model', 'Table', 'Primary Key', 'Connection', 'Fields', 'Relations'],
      rows
    );
    return ExitCode.SUCCESS;
  }
}
