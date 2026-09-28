import type { SelectAst, InsertAst, UpdateAst, DeleteAst, CountAst, ExistsAst } from './ast.js';
import type { CompiledQuery } from '../public/types.js';
export interface SqlCompilerOptions {
    readonly placeholderType?: 'question' | 'dollar';
    readonly quoteIdentifiers?: boolean;
}
export declare class SqlCompiler {
    private readonly placeholderType;
    private readonly quoteIdentifiers;
    constructor(options?: SqlCompilerOptions);
    escapeIdentifier(identifier: string): string;
    private createPlaceholder;
    compileSelect(ast: SelectAst): CompiledQuery;
    compileInsert(ast: InsertAst): CompiledQuery;
    compileUpdate(ast: UpdateAst): CompiledQuery;
    compileDelete(ast: DeleteAst): CompiledQuery;
    compileCount(ast: CountAst): CompiledQuery;
    compileExists(ast: ExistsAst): CompiledQuery;
    private compileWhereClause;
}
//# sourceMappingURL=compiler.d.ts.map