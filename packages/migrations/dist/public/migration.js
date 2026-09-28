import { SqlMigrationCompiler } from '../internal/compiler.js';
import { IrreversibleMigrationError } from './errors.js';
export class MigrationContext {
    connection;
    dialect;
    compiler;
    constructor(connection, dialect = 'memory') {
        this.connection = connection;
        this.dialect = dialect;
        this.compiler = new SqlMigrationCompiler(dialect);
    }
    async sql(sql, params) {
        await this.connection.query(sql, params);
    }
    async executeOperation(operation) {
        const ddl = this.compiler.compile(operation);
        await this.sql(ddl);
    }
}
export class Migration {
    id;
    name;
    connection;
    operations;
    isDestructive;
    isReversible;
    upFn;
    downFn;
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.connection = options.connection;
        this.operations = options.operations ? Object.freeze([...options.operations]) : undefined;
        this.upFn = options.up;
        this.downFn = options.down;
        if (this.operations) {
            this.isDestructive = options.isDestructive ?? this.operations.some((op) => op.isDestructive);
            this.isReversible = this.operations.every((op) => op.isReversible);
        }
        else {
            this.isDestructive = options.isDestructive ?? false;
            this.isReversible = this.downFn !== undefined;
        }
        Object.freeze(this);
    }
    async up(ctx) {
        if (this.upFn) {
            await this.upFn(ctx);
            return;
        }
        if (this.operations) {
            for (const op of this.operations) {
                await ctx.executeOperation(op);
            }
            return;
        }
        throw new Error(`Migration '${this.id}' has neither up function nor operations defined.`);
    }
    async down(ctx) {
        if (this.downFn) {
            await this.downFn(ctx);
            return;
        }
        if (this.operations) {
            // Revert operations in reverse order
            for (let i = this.operations.length - 1; i >= 0; i--) {
                const op = this.operations[i];
                const rev = op.getReverse();
                if (!rev) {
                    throw new IrreversibleMigrationError(this.id, op.type);
                }
                await ctx.executeOperation(rev);
            }
            return;
        }
        throw new IrreversibleMigrationError(this.id);
    }
}
//# sourceMappingURL=migration.js.map