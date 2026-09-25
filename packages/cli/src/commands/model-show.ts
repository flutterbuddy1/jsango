import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class ModelShowCommand extends BaseCommand {
  public readonly name = 'model:show';
  public readonly description = 'Show detailed information about a specific ORM model';
  public readonly usage = 'jsango model:show <modelName>';
  public readonly arguments = [
    {
      name: 'modelName',
      description: 'The name of the model to inspect',
      required: true,
      type: 'string' as const,
    },
  ];

  public execute(context: CommandContext): number {
    const modelName = context.args[0] as string;
    const registry = context.getModelRegistry();
    const model = registry.getModel(modelName);

    if (!model) {
      context.output.error(`Model "${modelName}" not found in registry.`);
      return ExitCode.USAGE_ERROR;
    }

    const meta = model.metadata;

    if (context.output.isJson) {
      context.output.json(meta.toJSON());
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(`${colors.bold('MODEL')}: ${colors.cyan(meta.name)}`);
    context.output.text(`  Table:        ${meta.table}`);
    context.output.text(`  Connection:   ${meta.connection}`);
    context.output.text(`  Primary Key:  ${meta.primaryKey}`);
    context.output.text(`  Timestamps:   ${meta.timestamps.enabled ? 'Yes' : 'No'}`);
    context.output.text(`  Soft Delete:  ${meta.softDelete.enabled ? 'Yes' : 'No'}`);
    context.output.text();

    context.output.text(colors.bold('FIELDS'));
    const fieldRows = [...meta.fields.values()].map((f) => [
      f.name,
      colors.yellow(f.type),
      f.columnName,
      f.primaryKey ? colors.green('YES') : 'No',
      f.nullable ? 'Yes' : 'No',
      f.defaultValue !== undefined ? String(f.defaultValue) : '-',
    ]);
    context.output.table(['Field', 'Type', 'Column', 'PK', 'Nullable', 'Default'], fieldRows);
    context.output.text();

    if (meta.relations.size > 0) {
      context.output.text(colors.bold('RELATIONS'));
      const relationRows = [...meta.relations.values()].map((r) => [
        r.name,
        colors.magenta(r.type),
        r.foreignKey,
        r.localKey,
      ]);
      context.output.table(['Relation', 'Type', 'Foreign Key', 'Local Key'], relationRows);
      context.output.text();
    }

    return ExitCode.SUCCESS;
  }
}
