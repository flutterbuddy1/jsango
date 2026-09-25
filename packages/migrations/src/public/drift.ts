import type { IDatabaseConnection } from '@django-js/database';
import type { ModelMetadata } from '@django-js/orm';
import { SchemaDiffEngine } from './diff.js';
import { SchemaIntrospector } from './introspector.js';
import { ModelSchemaConverter } from '../internal/converter.js';
import type { DriftDetectionResult } from './types.js';
import type { MigrationDialect } from '../internal/compiler.js';

export class DriftDetector {
  private readonly introspector: SchemaIntrospector;

  public constructor(dialect: MigrationDialect = 'memory') {
    this.introspector = new SchemaIntrospector(dialect);
  }

  public async detectDrift(
    connection: IDatabaseConnection,
    models: readonly ModelMetadata[]
  ): Promise<DriftDetectionResult> {
    const expectedSnapshot = ModelSchemaConverter.convert(models);
    const actualSnapshot = await this.introspector.introspect(connection);

    const diff = SchemaDiffEngine.diff(expectedSnapshot, actualSnapshot);
    const differences: string[] = [];

    for (const op of diff.operations) {
      differences.push(`[${op.type}] ${JSON.stringify(op.toJSON())}`);
    }

    return {
      hasDrift: diff.hasChanges,
      differences: Object.freeze(differences),
      diff,
    };
  }
}
