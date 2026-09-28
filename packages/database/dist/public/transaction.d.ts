import type { DatabaseResult, IDatabaseTransaction, IDriverConnection, QueryOptions } from './types.js';
import type { SqlDialect } from '../internal/dialect.js';
export type TransactionState = 'active' | 'committed' | 'rolledBack';
export declare class DatabaseTransaction implements IDatabaseTransaction {
    readonly id: string;
    private readonly rawConnection;
    private readonly dialect;
    private state;
    private readonly onCompleted?;
    constructor(id: string, rawConnection: IDriverConnection, dialect: SqlDialect, onCompleted?: (() => void) | undefined);
    get isCompleted(): boolean;
    get currentState(): TransactionState;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], options?: QueryOptions): Promise<DatabaseResult<T>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    savepoint(name: string): Promise<void>;
    rollbackTo(name: string): Promise<void>;
    releaseSavepoint(name: string): Promise<void>;
    private validateSavepointName;
    private assertActive;
}
//# sourceMappingURL=transaction.d.ts.map