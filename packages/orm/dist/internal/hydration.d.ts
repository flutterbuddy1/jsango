import type { ModelMetadata } from '../public/metadata.js';
import type { Model } from '../public/model.js';
import type { ModelStatic } from '../public/types.js';
export declare class Hydrator {
    static hydrateRow(rawRow: Record<string, unknown>, metadata: ModelMetadata): Record<string, unknown>;
    static hydrateModel<TModel extends Model>(rawRow: Record<string, unknown>, modelClass: ModelStatic<TModel>): TModel;
    static hydrateModels<TModel extends Model>(rawRows: readonly Record<string, unknown>[], modelClass: ModelStatic<TModel>): readonly TModel[];
}
//# sourceMappingURL=hydration.d.ts.map