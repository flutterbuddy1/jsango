import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import {
  AddColumnOperation,
  AlterColumnOperation,
  MigrationGenerator,
  ModelSchemaConverter,
  SchemaDiffEngine,
  SchemaState,
  type Migration,
  type MigrationOperation,
} from '@jsango/migrations';
import type { ModelStatic } from '@jsango/orm';
import { ProjectDiscovery } from '../internal/project.js';
import { CONNECTION_OPTION, connectionOption } from '../internal/db-command.js';

/** Loosely typed view of MigrationOperation.toJSON() used for display. */
type OpJson = Record<string, string> & {
  table: { name: string; columns: { name: string }[] };
  column: { name: string; type: string };
  index: { name: string };
  constraint: { name: string };
  foreignKey: { name: string };
};

/** Suggests a migration name from its operations, e.g. `create_users` or `add_age_to_users`. */
function suggestName(ops: readonly MigrationOperation[]): string {
  if (ops.length === 0) return 'empty';
  const first = ops[0]!.toJSON() as OpJson;
  let name: string;
  switch (first['type']) {
    case 'create_table':
      name = `create_${first['table']['name']}`;
      break;
    case 'drop_table':
      name = `drop_${first['tableName']}`;
      break;
    case 'add_column':
      name = `add_${first['column']['name']}_to_${first['tableName']}`;
      break;
    case 'drop_column':
      name = `remove_${first['columnName']}_from_${first['tableName']}`;
      break;
    case 'alter_column':
      name = `alter_${first['tableName']}_${first['column']['name']}`;
      break;
    default:
      name = String(first['type']);
  }
  return ops.length > 1 ? `${name}_and_more` : name;
}

export class MigrateGenerateCommand extends BaseCommand {
  public readonly name = 'migrate:generate';
  public readonly description =
    'Create a migration from changes to your ORM models (like Django makemigrations)';
  public readonly usage = 'jsango migrate:generate [name] [options]';
  public readonly aliases = ['makemigrations', 'make:migration'];
  public readonly arguments = [
    {
      name: 'name',
      description: 'Migration name, e.g. create_users (derived from the changes when omitted)',
      required: false,
      type: 'string' as const,
    },
  ];
  public readonly options = [
    {
      name: 'dir',
      short: 'd',
      description: 'Migrations directory (default: from jsango.config, else ./migrations)',
      type: 'string' as const,
    },
    CONNECTION_OPTION,
    {
      name: 'empty',
      description: 'Create an empty hand-written migration (up/down functions)',
      type: 'boolean' as const,
    },
    {
      name: 'dry-run',
      description: 'Show the detected changes without writing a file',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const project = await context.loadProject();
    const connection = connectionOption(context);
    const dryRun = Boolean(context.options['dry-run']);

    const dirOption = context.options['dir'] as string | undefined;
    const migrationsDir = dirOption
      ? ProjectDiscovery.assertSafePath(dirOption, context.projectRoot)
      : (project?.migrationsDir ??
        ProjectDiscovery.assertSafePath('migrations', context.projectRoot));

    const db = await context.getDatabaseManager();
    const resolveConn = (name: string | undefined): string => {
      if (db && typeof db.resolveConnectionName === 'function') {
        try {
          return db.resolveConnectionName(name);
        } catch {
          return name ?? 'default';
        }
      }
      return !name || name === 'default' ? 'default' : name;
    };
    const targetConnection = resolveConn(connection);
    const genOptions = connection ? { connection } : undefined;

    const explicitName = context.args[0] as string | undefined;

    if (context.options['empty']) {
      const generated = MigrationGenerator.generateEmpty(explicitName ?? 'custom', genOptions);
      return this.write(context, migrationsDir, generated, [], dryRun);
    }

    // Models for this connection
    const models = context
      .getModelRegistry()
      .getAllModels()
      .filter((m: ModelStatic) => resolveConn(m.metadata.connection) === targetConnection);

    if (models.length === 0) {
      context.output.warn(
        project?.modelFiles.length === 0
          ? 'No ORM models found. Put defineModel() files in src/models (or set "models" in jsango.config.ts).'
          : `No ORM models use connection [${targetConnection}]. Nothing to generate.`
      );
      return ExitCode.SUCCESS;
    }

    // Current schema = what the existing migrations produce (no database needed).
    const existing = context
      .getMigrationRegistry()
      .getAllMigrations()
      .filter((m: Migration) => resolveConn(m.connection) === targetConnection);

    const state = await SchemaState.fromMigrations(existing);
    const current = state.toSnapshot();
    const expected = ModelSchemaConverter.convert(models.map((m) => m.metadata));

    const diff = SchemaDiffEngine.diff(expected, current);

    if (!diff.hasChanges) {
      if (context.output.isJson) {
        context.output.json({ changes: false, operations: [] });
      } else {
        context.output.text('No changes detected. Models and migrations are in sync.');
      }
      return ExitCode.SUCCESS;
    }

    const name = explicitName ?? suggestName(diff.operations);
    const generated = MigrationGenerator.generate(name, diff, genOptions);

    // Warn about changes that fail on tables that already contain rows.
    const warnings: string[] = [];
    for (const op of diff.operations) {
      if (op instanceof AddColumnOperation) {
        const col = op.column;
        if (col.nullable === false && col.defaultValue === undefined && !col.autoIncrement) {
          warnings.push(
            `Column ${op.tableName}.${col.name} is NOT NULL without a default: applying this fails if "${op.tableName}" already has rows. Add { nullable: true } or a default to the field if needed.`
          );
        }
      } else if (op instanceof AlterColumnOperation && op.isDestructive && op.destructiveReason) {
        warnings.push(op.destructiveReason);
      }
    }
    for (const op of diff.destructiveOperations) {
      if (!(op instanceof AlterColumnOperation) && op.destructiveReason) {
        warnings.push(`[${op.type}] ${op.destructiveReason}`);
      }
    }

    return this.write(context, migrationsDir, generated, diff.operations, dryRun, warnings);
  }

  private write(
    context: CommandContext,
    migrationsDir: string,
    generated: { id: string; name: string; fileName: string; content: string },
    operations: readonly MigrationOperation[],
    dryRun: boolean,
    warnings: readonly string[] = []
  ): number {
    const { colors } = context.output;
    const targetFilePath = path.join(migrationsDir, generated.fileName);

    if (!dryRun) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      fs.writeFileSync(targetFilePath, generated.content, 'utf8');
    }

    if (context.output.isJson) {
      context.output.json({
        id: generated.id,
        name: generated.name,
        filePath: dryRun ? undefined : targetFilePath,
        dryRun,
        operations: operations.map((op) => op.toJSON()),
        isDestructive: operations.some((op) => op.isDestructive),
        warnings,
      });
      return ExitCode.SUCCESS;
    }

    const rel = path.relative(context.projectRoot, targetFilePath);
    if (dryRun) {
      context.output.text(colors.bold(`Would create ${rel}:`));
    } else {
      context.output.success(`Created migration ${colors.cyan(rel)}`);
    }
    for (const op of operations) {
      const badge = op.isDestructive ? colors.yellow('[destructive]') : colors.green('[+]');
      context.output.text(`  ${badge} ${describe(op)}`);
    }
    for (const warning of warnings) {
      context.output.warn(warning);
    }
    if (!dryRun) {
      context.output.text();
      context.output.text(
        `Review the file, then run ${colors.cyan('jsango migrate')} to apply it (${colors.cyan('jsango migrate --dry-run')} shows the SQL).`
      );
    }
    return ExitCode.SUCCESS;
  }
}

function describe(op: MigrationOperation): string {
  const j = op.toJSON() as OpJson;
  switch (j['type']) {
    case 'create_table':
      return `Create table ${j['table']['name']} (${(j['table']['columns'] as { name: string }[]).map((c) => c.name).join(', ')})`;
    case 'drop_table':
      return `Drop table ${j['tableName']}`;
    case 'add_column':
      return `Add column ${j['tableName']}.${j['column']['name']} (${j['column']['type']})`;
    case 'drop_column':
      return `Drop column ${j['tableName']}.${j['columnName']}`;
    case 'alter_column':
      return `Alter column ${j['tableName']}.${j['column']['name']}`;
    case 'create_index':
      return `Create index ${j['index']['name']} on ${j['tableName']}`;
    case 'drop_index':
      return `Drop index ${j['indexName']} on ${j['tableName']}`;
    case 'create_unique_constraint':
      return `Add unique ${j['constraint']['name']} on ${j['tableName']}`;
    case 'drop_unique_constraint':
      return `Drop unique ${j['constraintName']} on ${j['tableName']}`;
    case 'add_foreign_key':
      return `Add foreign key ${j['foreignKey']['name']} on ${j['tableName']}`;
    case 'drop_foreign_key':
      return `Drop foreign key ${j['foreignKeyName']} on ${j['tableName']}`;
    default:
      return String(j['type']);
  }
}
