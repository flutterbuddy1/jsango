import { DjangoJsError } from '@django-js/core';

export class MigrationError extends DjangoJsError {
  public constructor(options: {
    code?: string;
    message: string;
    cause?: unknown;
    metadata?: Record<string, unknown>;
  }) {
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
  public readonly ownerId?: string | undefined;
  public readonly lockTimeoutMs?: number | undefined;

  public constructor(message: string, ownerId?: string, lockTimeoutMs?: number) {
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
  public readonly destructiveOperations: readonly string[];

  public constructor(message: string, destructiveOperations: readonly string[]) {
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
  public readonly migrationId: string;
  public readonly operationType?: string | undefined;

  public constructor(migrationId: string, operationType?: string) {
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
  public readonly migrationId: string;

  public constructor(migrationId: string) {
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
  public constructor(message: string, cause?: unknown) {
    super({
      code: 'ERR_SCHEMA_DIFF',
      message,
      cause,
    });
    this.name = 'SchemaDiffError';
  }
}
