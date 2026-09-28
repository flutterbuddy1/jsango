import type { SchemaSnapshot } from './schema.js';
import { type MigrationOperation } from './operations.js';
export declare class SchemaDiff {
    readonly operations: readonly MigrationOperation[];
    readonly hasChanges: boolean;
    readonly hasDestructiveOperations: boolean;
    readonly destructiveOperations: readonly MigrationOperation[];
    readonly isReversible: boolean;
    constructor(operations: readonly MigrationOperation[]);
    getReverseOperations(): readonly MigrationOperation[];
    toJSON(): Record<string, unknown>;
}
export declare class SchemaDiffEngine {
    static diff(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff;
    private static diffTable;
}
//# sourceMappingURL=diff.d.ts.map