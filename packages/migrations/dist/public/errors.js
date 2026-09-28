import { JsangoError } from '@jsango/core';
export class MigrationError extends JsangoError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_MIGRATION',
            message: options.message,
            cause: options.cause,
            metadata: options.metadata,
        });
        this.name = 'MigrationError';
    }
}
export class MigrationLockedError extends MigrationError {
    ownerId;
    lockTimeoutMs;
    constructor(message, ownerId, lockTimeoutMs) {
        super({
            code: 'ERR_MIGRATION_LOCKED',
            message,
            metadata: { ownerId, lockTimeoutMs },
        });
        this.name = 'MigrationLockedError';
        this.ownerId = ownerId;
        this.lockTimeoutMs = lockTimeoutMs;
    }
}
export class DestructiveMigrationError extends MigrationError {
    destructiveOperations;
    constructor(message, destructiveOperations) {
        super({
            code: 'ERR_DESTRUCTIVE_MIGRATION',
            message,
            metadata: { destructiveOperations: [...destructiveOperations] },
        });
        this.name = 'DestructiveMigrationError';
        this.destructiveOperations = Object.freeze([...destructiveOperations]);
    }
}
export class IrreversibleMigrationError extends MigrationError {
    migrationId;
    operationType;
    constructor(migrationId, operationType) {
        super({
            code: 'ERR_IRREVERSIBLE_MIGRATION',
            message: `Migration '${migrationId}' cannot be reversed${operationType ? ` due to operation '${operationType}'` : ''}.`,
            metadata: { migrationId, operationType },
        });
        this.name = 'IrreversibleMigrationError';
        this.migrationId = migrationId;
        this.operationType = operationType;
    }
}
export class MigrationNotFoundError extends MigrationError {
    migrationId;
    constructor(migrationId) {
        super({
            code: 'ERR_MIGRATION_NOT_FOUND',
            message: `Migration '${migrationId}' was not found.`,
            metadata: { migrationId },
        });
        this.name = 'MigrationNotFoundError';
        this.migrationId = migrationId;
    }
}
export class SchemaDiffError extends MigrationError {
    constructor(message, cause) {
        super({
            code: 'ERR_SCHEMA_DIFF',
            message,
            cause,
        });
        this.name = 'SchemaDiffError';
    }
}
//# sourceMappingURL=errors.js.map