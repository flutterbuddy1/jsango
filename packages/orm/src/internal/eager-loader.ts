import type { Model } from '../public/model.js';
import type { QueryContext } from '../public/types.js';
import type { ModelRegistry } from '../public/registry.js';
import { RelationError } from '../public/errors.js';

export class EagerLoader {
  public static async loadRelations(
    models: readonly Model[],
    relationNames: readonly string[],
    registry: ModelRegistry,
    context?: QueryContext
  ): Promise<void> {
    if (models.length === 0 || relationNames.length === 0) {
      return;
    }

    const firstModel = models[0]!;
    const meta = (firstModel.constructor as typeof Model).metadata;

    for (const relName of relationNames) {
      const relMeta = meta.getRelation(relName);
      if (!relMeta) {
        throw new RelationError(
          meta.name,
          relName,
          `Relation '${relName}' is not defined on model '${meta.name}'.`
        );
      }

      const TargetModel = relMeta.resolveTarget((name) => registry.getModel(name));

      switch (relMeta.type) {
        case 'hasMany': {
          const parentKey = relMeta.localKey;
          const foreignKey = relMeta.foreignKey;
          const parentIds = [
            ...new Set(
              models.map((m) => m.get(parentKey)).filter((id) => id !== undefined && id !== null)
            ),
          ];

          if (parentIds.length === 0) {
            for (const m of models) {
              m.setRelation(relName, Object.freeze([]));
            }
            break;
          }

          let query = TargetModel.query().whereIn(foreignKey, parentIds);
          if (context) {
            query = query.using(context);
          }
          const children = await query.get();

          // Group children by foreign key
          const grouped = new Map<unknown, Model[]>();
          for (const child of children) {
            const fkVal = child.get(foreignKey);
            if (!grouped.has(fkVal)) {
              grouped.set(fkVal, []);
            }
            grouped.get(fkVal)!.push(child);
          }

          for (const parent of models) {
            const pk = parent.get(parentKey);
            const matched = grouped.get(pk) ?? [];
            parent.setRelation(relName, Object.freeze([...matched]));
          }
          break;
        }

        case 'hasOne': {
          const parentKey = relMeta.localKey;
          const foreignKey = relMeta.foreignKey;
          const parentIds = [
            ...new Set(
              models.map((m) => m.get(parentKey)).filter((id) => id !== undefined && id !== null)
            ),
          ];

          if (parentIds.length === 0) {
            for (const m of models) {
              m.setRelation(relName, null);
            }
            break;
          }

          let query = TargetModel.query().whereIn(foreignKey, parentIds);
          if (context) {
            query = query.using(context);
          }
          const children = await query.get();

          const indexed = new Map<unknown, Model>();
          for (const child of children) {
            const fkVal = child.get(foreignKey);
            if (!indexed.has(fkVal)) {
              indexed.set(fkVal, child);
            }
          }

          for (const parent of models) {
            const pk = parent.get(parentKey);
            const matched = indexed.get(pk) ?? null;
            parent.setRelation(relName, matched);
          }
          break;
        }

        case 'belongsTo': {
          const foreignKey = relMeta.foreignKey;
          const targetKey = relMeta.localKey;
          const foreignKeys = [
            ...new Set(
              models.map((m) => m.get(foreignKey)).filter((fk) => fk !== undefined && fk !== null)
            ),
          ];

          if (foreignKeys.length === 0) {
            for (const m of models) {
              m.setRelation(relName, null);
            }
            break;
          }

          let query = TargetModel.query().whereIn(targetKey, foreignKeys);
          if (context) {
            query = query.using(context);
          }
          const relatedModels = await query.get();

          const indexed = new Map<unknown, Model>();
          for (const item of relatedModels) {
            const tkVal = item.get(targetKey);
            indexed.set(tkVal, item);
          }

          for (const parent of models) {
            const fk = parent.get(foreignKey);
            const matched = indexed.get(fk) ?? null;
            parent.setRelation(relName, matched);
          }
          break;
        }

        case 'manyToMany': {
          const localKey = relMeta.localKey;
          const pivotFk = relMeta.pivotForeignKey ?? `${meta.name.toLowerCase()}Id`;
          const pivotTargetKey =
            relMeta.pivotTargetKey ?? `${TargetModel.modelName.toLowerCase()}Id`;
          const parentIds = [
            ...new Set(
              models.map((m) => m.get(localKey)).filter((id) => id !== undefined && id !== null)
            ),
          ];

          if (parentIds.length === 0) {
            for (const m of models) {
              m.setRelation(relName, Object.freeze([]));
            }
            break;
          }

          const ThroughModel = relMeta.resolveThrough((name) => registry.getModel(name));
          if (!ThroughModel) {
            throw new RelationError(
              meta.name,
              relName,
              `ManyToMany relation '${relName}' requires a valid 'through' model.`
            );
          }

          let pivotQuery = ThroughModel.query().whereIn(pivotFk, parentIds);
          if (context) {
            pivotQuery = pivotQuery.using(context);
          }
          const pivotRows = await pivotQuery.get();

          const targetIds = [
            ...new Set(
              pivotRows
                .map((pr) => pr.get(pivotTargetKey))
                .filter((tid) => tid !== undefined && tid !== null)
            ),
          ];

          let targetRecords: readonly Model[] = [];
          if (targetIds.length > 0) {
            let targetQuery = TargetModel.query().whereIn(
              TargetModel.metadata.primaryKey,
              targetIds
            );
            if (context) {
              targetQuery = targetQuery.using(context);
            }
            targetRecords = await targetQuery.get();
          }

          const targetMap = new Map<unknown, Model>();
          for (const tr of targetRecords) {
            targetMap.set(tr.get(TargetModel.metadata.primaryKey), tr);
          }

          // Group target models per parent
          const grouped = new Map<unknown, Model[]>();
          for (const pr of pivotRows) {
            const pid = pr.get(pivotFk);
            const tid = pr.get(pivotTargetKey);
            const targetInstance = targetMap.get(tid);
            if (targetInstance) {
              if (!grouped.has(pid)) {
                grouped.set(pid, []);
              }
              grouped.get(pid)!.push(targetInstance);
            }
          }

          for (const parent of models) {
            const pid = parent.get(localKey);
            const matched = grouped.get(pid) ?? [];
            parent.setRelation(relName, Object.freeze([...matched]));
          }
          break;
        }
      }
    }
  }
}
