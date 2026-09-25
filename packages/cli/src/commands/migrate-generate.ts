import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import {
  MigrationGenerator,
  ModelSchemaConverter,
  SchemaDiffEngine,
  SchemaIntrospector,
  SchemaSnapshot,
} from '@django-js/migrations';
import { ProjectDiscovery } from '../internal/project.js';

export class MigrateGenerateCommand extends BaseCommand {
  public readonly name = 'migrate:generate';
  public readonly description = 'Generate a new migration from ORM model schema diff';
  public readonly usage = 'django-js migrate:generate <name> [options]';
  public readonly arguments = [
    {
      name: 'name',
      description: 'The name of the migration (e.g. create_users)',
      required: true,
      type: 'string' as const,
    },
  ];
  public readonly options = [
    {
      name: 'dir',
      short: 'd',
      description: 'Directory where migration file should be written',
      type: 'string' as const,
      default: 'migrations',
    },
    {
      name: 'connection',
      short: 'c',
      description: 'Database connection name to compare against',
      type: 'string' as const,
      default: 'default',
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const migrationName = context.args[0] as string;
    const modelRegistry = context.getModelRegistry();
    const models = modelRegistry.getAllModels();

    if (models.length === 0) {
      context.output.warn('No ORM models registered. Nothing to generate.');
      return ExitCode.SUCCESS;
    }

    const expectedSnapshot = ModelSchemaConverter.convert(models.map((m) => m.metadata));

    // Determine current schema snapshot: introspect DB if available, else empty snapshot
    let currentSnapshot = SchemaSnapshot.empty();
    const db = await context.getDatabaseManager();
    const connectionName = (context.options['connection'] as string) || 'default';

    if (db) {
      try {
        const conn = await db.connection(connectionName);
        try {
          const introspector = new SchemaIntrospector('memory');
          currentSnapshot = await introspector.introspect(conn);
        } finally {
          if ('release' in conn && typeof conn.release === 'function') {
            await conn.release();
          }
        }
      } catch {
        // Fall back to empty snapshot
      }
    }

    // Compute diff: from current -> to expected
    const diff = SchemaDiffEngine.diff(currentSnapshot, expectedSnapshot);

    if (!diff.hasChanges) {
      context.output.text('No schema changes detected between ORM models and database.');
      return ExitCode.SUCCESS;
    }

    const genOptions = connectionName !== 'default' ? { connection: connectionName } : undefined;
    const generated = MigrationGenerator.generate(migrationName, diff, genOptions);

    const migrationsRelDir = (context.options['dir'] as string) || 'migrations';
    const targetDir = ProjectDiscovery.assertSafePath(migrationsRelDir, context.projectRoot);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, generated.fileName);
    fs.writeFileSync(targetFilePath, generated.content, 'utf8');

    if (context.output.isJson) {
      context.output.json({
        id: generated.id,
        name: generated.name,
        filePath: targetFilePath,
        operations: diff.operations.map((op) => op.toJSON()),
        isDestructive: diff.hasDestructiveOperations,
      });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.success(`Generated migration: ${colors.cyan(generated.fileName)}`);
    context.output.text(`  Path: ${targetFilePath}`);
    context.output.text(`  Operations (${diff.operations.length}):`);
    for (const op of diff.operations) {
      const isDestr = op.isDestructive;
      const badge = isDestr ? colors.yellow('[DESTRUCTIVE]') : colors.dim('[safe]');
      context.output.text(`    ${badge} ${op.type}`);
    }

    context.output.text();
    context.output.text(
      `Run ${colors.cyan('django-js migrate')} to execute this migration against your database.`
    );

    return ExitCode.SUCCESS;
  }
}
