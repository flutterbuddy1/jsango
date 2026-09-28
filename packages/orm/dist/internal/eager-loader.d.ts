import type { Model } from '../public/model.js';
import type { QueryContext } from '../public/types.js';
import type { ModelRegistry } from '../public/registry.js';
export declare class EagerLoader {
    static loadRelations(models: readonly Model[], relationNames: readonly string[], registry: ModelRegistry, context?: QueryContext): Promise<void>;
}
//# sourceMappingURL=eager-loader.d.ts.map