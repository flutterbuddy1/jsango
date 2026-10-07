import type { ModelMetadata } from '@jsango/orm';
import { AdminResource } from './resource.js';

export class AutoResourceGenerator {
  /** Derives a complete AdminResource from ORM ModelMetadata. */
  public static generateFromModel(metadata: ModelMetadata): AdminResource {
    return new AdminResource({
      id: metadata.name.toLowerCase(),
      modelName: metadata.name,
      primaryKey: metadata.primaryKey,
      modelMetadata: metadata,
      canSoftDelete: metadata.softDelete.enabled,
    });
  }
}
