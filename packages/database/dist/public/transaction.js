import { TransactionClosedError, TransactionError } from './errors.js';
export class DatabaseTransaction {
    id;
    rawConnection;
    dialect;
    state = 'active';
    onCompleted;
    constructor(id, rawConnection, dialect, onCompleted) {
        this.id = id;
        this.rawConnection = rawConnection;
        this.dialect = dialect;
        this.onCompleted = onCompleted;
    }
    get isCompleted() {
        return this.state !== 'active';
    }
    get currentState() {
        return this.state;
    }
    async query(sql, params, options) {
        this.assertActive('execute query');
        const normalizedSql = this.dialect.normalizePlaceholders(sql);
        return this.rawConnection.query(normalizedSql, params, options);
    }
    async commit() {
        this.assertActive('commit');
        try {
            await this.rawConnection.query('COMMIT');
            this.state = 'committed';
        }
        catch (err) {
            this.state = 'rolledBack';
            throw new TransactionError(`Failed to commit transaction: ${err instanceof Error ? err.message : String(err)}`, err);
        }
        finally {
            this.onCompleted?.();
        }
    }
    async rollback() {
        this.assertActive('rollback');
        try {
            await this.rawConnection.query('ROLLBACK');
            this.state = 'rolledBack';
        }
        catch (err) {
            this.state = 'rolledBack';
            throw new TransactionError(`Failed to rollback transaction: ${err instanceof Error ? err.message : String(err)}`, err);
        }
        finally {
            this.onCompleted?.();
        }
    }
    async savepoint(name) {
        this.assertActive('create savepoint');
        const cleanName = this.validateSavepointName(name);
        await this.rawConnection.query(`SAVEPOINT ${cleanName}`);
    }
    async rollbackTo(name) {
        this.assertActive('rollback to savepoint');
        const cleanName = this.validateSavepointName(name);
        await this.rawConnection.query(`ROLLBACK TO SAVEPOINT ${cleanName}`);
    }
    async releaseSavepoint(name) {
        this.assertActive('release savepoint');
        const cleanName = this.validateSavepointName(name);
        await this.rawConnection.query(`RELEASE SAVEPOINT ${cleanName}`);
    }
    validateSavepointName(name) {
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            throw new TransactionError(`Invalid savepoint name "${name}". Savepoint names must be alphanumeric.`);
        }
        return name;
    }
    assertActive(action) {
        if (this.state !== 'active') {
            throw new TransactionClosedError(action, this.state);
        }
    }
}
//# sourceMappingURL=transaction.js.map