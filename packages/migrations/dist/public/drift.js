import { SchemaDiffEngine } from './diff.js';
import { SchemaIntrospector } from './introspector.js';
import { ModelSchemaConverter } from '../internal/converter.js';
export class DriftDetector {
    introspector;
    constructor(dialect = 'memory') {
        this.introspector = new SchemaIntrospector(dialect);
    }
    async detectDrift(connection, models) {
        const expectedSnapshot = ModelSchemaConverter.convert(models);
        const actualSnapshot = await this.introspector.introspect(connection);
        const diff = SchemaDiffEngine.diff(expectedSnapshot, actualSnapshot);
        const differences = [];
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
//# sourceMappingURL=drift.js.map