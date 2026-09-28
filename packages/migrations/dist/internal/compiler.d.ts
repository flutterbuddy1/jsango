import type { ColumnDefinition, ColumnType } from '../public/types.js';
import { type MigrationOperation } from '../public/operations.js';
export type MigrationDialect = 'postgres' | 'sqlite' | 'mysql' | 'memory';
export declare class SqlMigrationCompiler {
    private readonly dialect;
    constructor(dialect?: MigrationDialect);
    compile(operation: MigrationOperation): string;
    quoteIdentifier(identifier: string): string;
    mapType(type: ColumnType, col?: ColumnDefinition): string;
    private compileColumnDef;
    private formatDefault;
    private compileCreateTable;
    private compileDropTable;
    private compileAddColumn;
    private compileDropColumn;
    private compileAlterColumn;
    private compileRenameColumn;
    private compileRenameTable;
    private compileCreateIndex;
    private compileDropIndex;
    private compileCreateUniqueConstraint;
    private compileDropUniqueConstraint;
    private compileAddForeignKey;
    private compileDropForeignKey;
}
//# sourceMappingURL=compiler.d.ts.map