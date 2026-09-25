import type { FieldType } from '@django-js/orm';
import type { MigrationContext } from './migration.js';

export type ColumnType = FieldType;

export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

export interface ColumnDefinition {
  readonly name: string;
  readonly type: ColumnType;
  readonly nullable?: boolean | undefined;
  readonly primaryKey?: boolean | undefined;
  readonly autoIncrement?: boolean | undefined;
  readonly unique?: boolean | undefined;
  readonly defaultValue?: unknown;
  readonly length?: number | undefined;
  readonly precision?: number | undefined;
  readonly scale?: number | undefined;
  readonly comment?: string | undefined;
}

export interface IndexDefinition {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean | undefined;
}

export interface ForeignKeyDefinition {
  readonly name: string;
  readonly columns: readonly string[];
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
  readonly onDelete?: ForeignKeyAction | undefined;
  readonly onUpdate?: ForeignKeyAction | undefined;
}

export interface UniqueConstraintDefinition {
  readonly name: string;
  readonly columns: readonly string[];
}

export interface TableDefinition {
  readonly name: string;
  readonly columns: readonly ColumnDefinition[];
  readonly primaryKey?: readonly string[] | undefined;
  readonly indexes?: readonly IndexDefinition[] | undefined;
  readonly foreignKeys?: readonly ForeignKeyDefinition[] | undefined;
  readonly uniqueConstraints?: readonly UniqueConstraintDefinition[] | undefined;
  readonly comment?: string | undefined;
}

export interface SchemaSnapshotData {
  readonly version: number;
  readonly createdAt: string;
  readonly tables: readonly TableDefinition[];
}

export interface MigrationRecord {
  readonly id: string;
  readonly name: string;
  readonly appliedAt: Date;
  readonly batch: number;
  readonly checksum?: string | undefined;
}

export interface MigrationDefinition {
  readonly id: string;
  readonly name: string;
  readonly timestamp?: string | undefined;
  readonly connection?: string | undefined;
  readonly up: (ctx: MigrationContext) => Promise<void>;
  readonly down?: ((ctx: MigrationContext) => Promise<void>) | undefined;
  readonly isReversible?: boolean | undefined;
  readonly isDestructive?: boolean | undefined;
}

export interface MigrationStatus {
  readonly applied: readonly MigrationRecord[];
  readonly pending: readonly MigrationDefinition[];
  readonly latestBatch: number;
  readonly currentVersion: string | null;
  readonly isUpToDate: boolean;
}

export interface MigrateOptions {
  readonly target?: string | undefined;
  readonly allowDestructive?: boolean | undefined;
  readonly connection?: string | undefined;
  readonly dryRun?: boolean | undefined;
}

export interface RollbackOptions {
  readonly steps?: number | undefined;
  readonly target?: string | undefined;
  readonly allowDestructive?: boolean | undefined;
  readonly connection?: string | undefined;
}

export interface ResetOptions {
  readonly confirm: 'YES_I_AM_SURE';
  readonly connection?: string | undefined;
}

export interface DriftDetectionResult {
  readonly hasDrift: boolean;
  readonly differences: readonly string[];
  readonly diff?: unknown;
}
