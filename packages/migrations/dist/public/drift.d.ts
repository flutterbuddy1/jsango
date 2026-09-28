import type { IDatabaseConnection } from '@jsango/database';
import type { ModelMetadata } from '@jsango/orm';
import type { DriftDetectionResult } from './types.js';
import type { MigrationDialect } from '../internal/compiler.js';
export declare class DriftDetector {
    private readonly introspector;
    constructor(dialect?: MigrationDialect);
    detectDrift(connection: IDatabaseConnection, models: readonly ModelMetadata[]): Promise<DriftDetectionResult>;
}
//# sourceMappingURL=drift.d.ts.map