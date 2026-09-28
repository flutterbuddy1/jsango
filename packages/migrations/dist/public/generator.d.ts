import type { SchemaDiff } from './diff.js';
export interface GeneratedMigration {
    readonly id: string;
    readonly name: string;
    readonly fileName: string;
    readonly content: string;
}
export declare class MigrationGenerator {
    static generateTimestamp(date?: Date): string;
    static generate(name: string, diff: SchemaDiff, options?: {
        timestamp?: string;
        connection?: string;
    }): GeneratedMigration;
    private static formatOperation;
}
//# sourceMappingURL=generator.d.ts.map