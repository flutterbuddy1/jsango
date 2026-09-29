import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import {
  MigrationRunner,
  ModelSchemaConverter,
  SchemaDiffEngine,
  SchemaState,
} from '@jsango/migrations';
import { CONNECTION_OPTION, connectionOption } from '../internal/db-command.js';

/**
 * CI guard: fails when models have changes that no migration captures, or (when a database is
 * configured) when migrations are pending.
 */
export class MigrateCheckCommand extends BaseCommand {
  public readonly name = 'migrate:check';
  public readonly description =
    'Fail if models have unmigrated changes or migrations are pending (for CI / deploy checks)';
  public readonly usage = 'jsango migrate:check [options]';
  public readonly options = [
    CONNECTION_OPTION,
    {
      name: 'skip-db',
      description: 'Only compare models with migration files; do not connect to the database',
      type: 'boolean' as const,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    await context.loadProject();
    const { colors } = context.output;
    const db = context.options['skip-db'] ? undefined : await context.getDatabaseManager();
    const requested = connectionOption(context);

    const resolve = (name: string | undefined): string => {
      if (db) {
        try {
          return db.resolveConnectionName(name);
        } catch {
          return name ?? 'default';
        }
      }
      return !name || name === 'default' ? 'default' : name;
    };
    const connection = resolve(requested);

    const models = context
      .getModelRegistry()
      .getAllModels()
      .filter((m) => resolve(m.metadata.connection) === connection);
    const migrations = context
      .getMigrationRegistry()
      .getAllMigrations()
      .filter((m) => resolve(m.connection) === connection);

    const problems: string[] = [];

    try {
      const state = await SchemaState.fromMigrations(migrations);
      const diff = SchemaDiffEngine.diff(
        ModelSchemaConverter.convert(models.map((m) => m.metadata)),
        state.toSnapshot()
      );
      if (diff.hasChanges) {
        problems.push(
          `${diff.operations.length} model change(s) are not in any migration (${[...new Set(diff.operations.map((o) => o.type))].join(', ')}). Run "jsango migrate:generate".`
        );
      }

      let pending: string[] = [];
      if (db) {
        const runner = new MigrationRunner({ databaseManager: db, registry: context.getMigrationRegistry() });
        const status = await runner.status(connection);
        pending = status.pending.map((m) => m.id);
        if (pending.length > 0) {
          problems.push(`${pending.length} migration(s) are not applied: ${pending.join(', ')}. Run "jsango migrate".`);
        }
      }

      if (context.output.isJson) {
        context.output.json({ connection, ok: problems.length === 0, problems, pending });
        return problems.length === 0 ? ExitCode.SUCCESS : ExitCode.MIGRATION_ERROR;
      }

      if (problems.length === 0) {
        context.output.success(
          `[${connection}] Models, migration files${db ? ' and database' : ''} are in sync.`
        );
        return ExitCode.SUCCESS;
      }

      for (const problem of problems) {
        context.output.text(`  ${colors.red('✖')} ${problem}`);
      }
      return ExitCode.MIGRATION_ERROR;
    } catch (err) {
      context.output.error(`Migration check failed: ${err instanceof Error ? err.message : String(err)}`);
      return ExitCode.MIGRATION_ERROR;
    }
  }
}
