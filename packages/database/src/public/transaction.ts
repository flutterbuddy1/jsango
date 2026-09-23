import type {
  DatabaseResult,
  IDatabaseTransaction,
  IDriverConnection,
  QueryOptions,
} from './types.js';
import { TransactionClosedError, TransactionError } from './errors.js';
import type { SqlDialect } from '../internal/dialect.js';

export type TransactionState = 'active' | 'committed' | 'rolledBack';

export class DatabaseTransaction implements IDatabaseTransaction {
  public readonly id: string;
  private readonly rawConnection: IDriverConnection;
  private readonly dialect: SqlDialect;
  private state: TransactionState = 'active';
  private readonly onCompleted?: (() => void) | undefined;

  constructor(
    id: string,
    rawConnection: IDriverConnection,
    dialect: SqlDialect,
    onCompleted?: (() => void) | undefined
  ) {
    this.id = id;
    this.rawConnection = rawConnection;
    this.dialect = dialect;
    this.onCompleted = onCompleted;
  }

  public get isCompleted(): boolean {
    return this.state !== 'active';
  }

  public get currentState(): TransactionState {
    return this.state;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    this.assertActive('execute query');
    const normalizedSql = this.dialect.normalizePlaceholders(sql);
    return this.rawConnection.query<T>(normalizedSql, params, options);
  }

  public async commit(): Promise<void> {
    this.assertActive('commit');

    try {
      await this.rawConnection.query('COMMIT');
      this.state = 'committed';
    } catch (err) {
      this.state = 'rolledBack';
      throw new TransactionError(
        `Failed to commit transaction: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    } finally {
      this.onCompleted?.();
    }
  }

  public async rollback(): Promise<void> {
    this.assertActive('rollback');

    try {
      await this.rawConnection.query('ROLLBACK');
      this.state = 'rolledBack';
    } catch (err) {
      this.state = 'rolledBack';
      throw new TransactionError(
        `Failed to rollback transaction: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    } finally {
      this.onCompleted?.();
    }
  }

  public async savepoint(name: string): Promise<void> {
    this.assertActive('create savepoint');
    const cleanName = this.validateSavepointName(name);
    await this.rawConnection.query(`SAVEPOINT ${cleanName}`);
  }

  public async rollbackTo(name: string): Promise<void> {
    this.assertActive('rollback to savepoint');
    const cleanName = this.validateSavepointName(name);
    await this.rawConnection.query(`ROLLBACK TO SAVEPOINT ${cleanName}`);
  }

  public async releaseSavepoint(name: string): Promise<void> {
    this.assertActive('release savepoint');
    const cleanName = this.validateSavepointName(name);
    await this.rawConnection.query(`RELEASE SAVEPOINT ${cleanName}`);
  }

  private validateSavepointName(name: string): string {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new TransactionError(
        `Invalid savepoint name "${name}". Savepoint names must be alphanumeric.`
      );
    }
    return name;
  }

  private assertActive(action: string): void {
    if (this.state !== 'active') {
      throw new TransactionClosedError(action, this.state);
    }
  }
}
