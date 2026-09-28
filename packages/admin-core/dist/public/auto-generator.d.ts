import type { ModelMetadata } from '@jsango/orm';
import { AdminResource } from './resource.js';
export declare class AutoResourceGenerator {
    /**
     * Automatically derives a complete AdminResource configuration from ORM ModelMetadata.
     */
    static generateFromModel(metadata: ModelMetadata): AdminResource;
    private static mapOrmTypeToAdminType;
}
//# sourceMappingURL=auto-generator.d.ts.map